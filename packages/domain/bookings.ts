/**
 * Booking lifecycle rules shared by the booking and admin services:
 * couple cancellations (tiers) and reschedules, provider cancellations
 * (alternatives + fine), delivery, the dispute window and dispute outcomes.
 */
import prisma from "@packages/libs/prisma";
import { notify, notifyAdmins } from "@packages/libs/notify";
import { ValidationError } from "@packages/error-handler";
import {
  COUPLE_CANCELLATION_TIERS,
  DISPUTE_PRESETS,
  REPLACEMENT_DECISION_DAYS,
  getSettings,
} from "@packages/utils/config";
import { addDays, daysUntil, kigaliStartOfDay, kigaliToday } from "@packages/utils/dates";
import { calculatePrice, SelectionInput } from "@packages/utils/pricing";
import { checkAvailability } from "./availability";
import { formatRwf, ledger, refundBooking, settleBooking } from "./money";
import { createCancellationPenalty } from "./penalties";

type Booking = NonNullable<Awaited<ReturnType<typeof prisma.bookings.findUnique>>>;

export const getBookingOr404 = async (id: string) => {
  const booking = await prisma.bookings.findUnique({ where: { id } });
  if (!booking) throw new ValidationError("Booking not found");
  return booking;
};

/** Service amount the couple paid (the booking fee is excluded) */
export const servicePaid = (b: Booking) => Math.max(0, b.amountPaid - Math.min(b.amountPaid, b.bookingFee));

export const balanceDueDateFor = (eventDate: string, balanceDueDays: number) => {
  const due = addDays(eventDate, -balanceDueDays);
  const today = kigaliToday();
  return due < today ? today : due;
};

// ───────────── Couple cancellation (tiered refunds) ─────────────

export const coupleCancellationQuote = (b: Booking) => {
  const days = daysUntil(b.eventDate);
  const tier = COUPLE_CANCELLATION_TIERS.find((t) => days >= t.minDays) ?? COUPLE_CANCELLATION_TIERS[COUPLE_CANCELLATION_TIERS.length - 1];
  const paid = servicePaid(b);
  const refund = Math.round((paid * tier.refundPercent) / 100);
  return { daysBeforeEvent: days, refundPercent: tier.refundPercent, tierLabel: tier.label, servicePaid: paid, refund, bookingFeeKept: Math.min(b.amountPaid, b.bookingFee) };
};

export const cancelByCouple = async (bookingId: string, reason: string, auto = false) => {
  const b = await getBookingOr404(bookingId);
  if (b.status === "pending_payment") {
    await prisma.bookings.update({ where: { id: b.id }, data: { status: "expired", holdExpiresAt: null } });
    return { refund: 0 };
  }
  if (b.status !== "confirmed") throw new ValidationError("Only upcoming confirmed bookings can be cancelled");

  const quote = coupleCancellationQuote(b);
  const refunded = quote.refund > 0 ? await refundBooking(b.id, quote.refund, `Couple cancellation (${quote.refundPercent}% refund)`) : 0;

  await prisma.bookings.update({ where: { id: b.id }, data: { status: "cancelled_by_couple", cancelledAt: new Date() } });
  await prisma.cancellations.create({
    data: {
      bookingId: b.id,
      initiatedBy: auto ? "admin" : "couple",
      reasonCategory: auto ? "balance_unpaid" : "couple_request",
      reason,
      daysBeforeEvent: quote.daysBeforeEvent,
      refundAmount: refunded,
    },
  });
  // Provider keeps the non-refunded share (minus 15% and fees), paid Thursday
  const settled = await settleBooking(b.id, false);
  await prisma.cancellations.updateMany({ where: { bookingId: b.id }, data: { providerShare: settled?.providerAmount || 0 } });

  await notify({
    recipientId: b.sellerId,
    recipientType: "seller",
    title: "Booking cancelled by the couple",
    message: `The booking for ${b.serviceTitle} on ${b.eventDate} was cancelled${auto ? " because the balance was not paid on time" : ""}. ${settled?.providerAmount ? `You keep ${formatRwf(settled.providerAmount)}, paid on Thursday.` : "No payment is due to you for this booking."}`,
    link: `/bookings/${b.id}`,
    critical: true,
    sms: `Booking on ${b.eventDate} (${b.serviceTitle}) was cancelled by the couple.`,
  });
  await notify({
    recipientId: b.userId,
    recipientType: "user",
    title: "Booking cancelled",
    message: `${b.serviceTitle} on ${b.eventDate} is cancelled. ${refunded > 0 ? `${formatRwf(refunded)} is being refunded to you.` : "Under the cancellation policy no refund applies."}`,
    link: `/bookings/${b.id}`,
    critical: auto,
  });
  return { refund: refunded };
};

// ───────────── Reschedule (one free change) ─────────────

export const rescheduleBooking = async (bookingId: string, newDate: string, newStartTime?: string) => {
  const b = await getBookingOr404(bookingId);
  if (b.status !== "confirmed") throw new ValidationError("Only upcoming confirmed bookings can be rescheduled");
  if (b.rescheduleUsed) throw new ValidationError("The free reschedule for this booking has already been used");
  if (newDate === b.eventDate && (!newStartTime || newStartTime === b.startTime)) {
    throw new ValidationError("Choose a different date or time");
  }
  const slot = await checkAvailability(b.sellerId, newDate, { excludeBookingId: b.id });
  if (!slot.available) {
    throw new ValidationError(`${slot.reason} You can pick another date, choose a different provider, or cancel under the cancellation policy.`);
  }
  const settings = await getSettings();
  const updated = await prisma.bookings.update({
    where: { id: b.id },
    data: {
      eventDate: newDate,
      startTime: newStartTime || b.startTime,
      rescheduleUsed: true,
      balanceDueDate: b.paymentStatus === "deposit_paid" ? balanceDueDateFor(newDate, settings.balanceDueDays) : b.balanceDueDate,
      balanceReminderSent: false,
    },
  });
  await notify({
    recipientId: b.sellerId,
    recipientType: "seller",
    title: "Booking rescheduled",
    message: `${b.serviceTitle} moved from ${b.eventDate} ${b.startTime} to ${updated.eventDate} ${updated.startTime}.`,
    link: `/bookings/${b.id}`,
    critical: true,
  });
  return updated;
};

// ───────────── Provider cancellation ─────────────

export const cancelByProvider = async (
  bookingId: string,
  input: { reasonCategory: string; reason?: string; evidence?: any[]; noShow?: boolean; initiatedBy?: "provider" | "admin" }
) => {
  const b = await getBookingOr404(bookingId);
  if (!["confirmed", "completed", "disputed"].includes(b.status)) {
    throw new ValidationError("This booking cannot be cancelled");
  }
  const days = daysUntil(b.eventDate);
  const eventStart = kigaliStartOfDay(b.eventDate);
  const deadline = new Date(Math.min(Date.now() + REPLACEMENT_DECISION_DAYS * 24 * 3600 * 1000, eventStart.getTime()));
  const canReplace = !input.noShow && days >= 1;

  await prisma.bookings.update({
    where: { id: b.id },
    data: {
      status: "cancelled_by_provider",
      cancelledAt: new Date(),
      resolution: canReplace ? "awaiting_choice" : "refunded",
      resolutionDeadline: canReplace ? deadline : null,
    },
  });
  await prisma.cancellations.create({
    data: {
      bookingId: b.id,
      initiatedBy: input.initiatedBy || "provider",
      reasonCategory: input.noShow ? "no_show" : input.reasonCategory,
      reason: input.reason,
      evidence: input.evidence || [],
      daysBeforeEvent: days,
      refundAmount: 0,
    },
  });
  // Providers are never paid for work they didn't do; the fine is decided separately
  await createCancellationPenalty(b, Boolean(input.noShow));

  if (canReplace) {
    await notify({
      recipientId: b.userId,
      recipientType: "user",
      title: "Your provider cancelled — your money is safe",
      message: `${b.serviceTitle} on ${b.eventDate} was cancelled by the provider. We've found available alternatives in the same category and price range. Choose a replacement or a full refund before ${deadline.toISOString().slice(0, 10)}.`,
      link: `/bookings/${b.id}`,
      type: "cancellation",
      critical: true,
      sms: `Your ${b.category} provider for ${b.eventDate} cancelled. Your money is safe - open HUZA to pick a replacement or refund.`,
    });
  } else {
    const refunded = await refundBooking(b.id, b.amountPaid, input.noShow ? "Provider no-show" : "Provider cancelled");
    await prisma.cancellations.updateMany({ where: { bookingId: b.id }, data: { refundAmount: refunded } });
    await notify({
      recipientId: b.userId,
      recipientType: "user",
      title: "Full refund issued",
      message: `${b.serviceTitle} (${b.eventDate}) was not delivered. ${formatRwf(refunded)} is being refunded to you.`,
      link: `/bookings/${b.id}`,
      critical: true,
    });
  }
  await notifyAdmins("Provider cancellation", `${b.serviceTitle} on ${b.eventDate} was cancelled by the provider.`, `/bookings/${b.id}`);
};

export const chooseRefund = async (bookingId: string) => {
  const b = await getBookingOr404(bookingId);
  if (b.status !== "cancelled_by_provider" || b.resolution !== "awaiting_choice") {
    throw new ValidationError("There is nothing to decide for this booking");
  }
  const refunded = await refundBooking(b.id, b.amountPaid, "Provider cancelled — couple chose a refund");
  await prisma.bookings.update({ where: { id: b.id }, data: { resolution: "refunded" } });
  await prisma.cancellations.updateMany({ where: { bookingId: b.id }, data: { refundAmount: refunded } });
  await notify({
    recipientId: b.userId,
    recipientType: "user",
    title: "Refund on its way",
    message: `${formatRwf(refunded)} is being refunded for ${b.serviceTitle}.`,
    link: `/bookings/${b.id}`,
    critical: true,
  });
  return refunded;
};

/**
 * The couple picks a replacement. The full amount they paid moves to the new
 * booking: a cheaper replacement is refunded the difference; a pricier one
 * leaves a balance to pay.
 */
export const chooseReplacement = async (
  bookingId: string,
  input: { serviceId: string; selections?: SelectionInput; startTime?: string }
) => {
  const old = await getBookingOr404(bookingId);
  if (old.status !== "cancelled_by_provider" || old.resolution !== "awaiting_choice") {
    throw new ValidationError("There is nothing to decide for this booking");
  }
  const service = await prisma.services.findUnique({ where: { id: input.serviceId } });
  if (!service || service.status !== "published" || service.isDeleted || service.category !== old.category) {
    throw new ValidationError("Please choose an available service from the same category");
  }
  const slot = await checkAvailability(service.sellerId, old.eventDate);
  if (!slot.available) throw new ValidationError(slot.reason || "That provider is no longer available");

  const priced = calculatePrice(service, input.selections || [], old.eventDistrict, service.serviceArea);
  const settings = await getSettings();
  const credit = old.amountPaid - old.refundedAmount;
  const totalDue = priced.price + old.bookingFee;
  const amountPaid = Math.min(credit, totalDue);

  const replacement = await prisma.bookings.create({
    data: {
      orderId: old.orderId,
      userId: old.userId,
      sellerId: service.sellerId,
      shopId: service.shopId,
      serviceId: service.id,
      serviceTitle: service.title,
      serviceImage: service.images[0]?.url,
      category: service.category,
      eventDate: old.eventDate,
      startTime: input.startTime || old.startTime,
      eventLocation: old.eventLocation,
      eventDistrict: old.eventDistrict,
      notes: old.notes,
      selectedOptions: priced.selectedOptions,
      basePrice: service.basePrice,
      optionsTotal: priced.optionsTotal,
      travelFee: priced.travelFee,
      price: priced.price,
      bookingFee: old.bookingFee,
      paymentPlan: amountPaid >= totalDue ? "full" : "deposit",
      depositAmount: Math.min(amountPaid, totalDue),
      balanceDueDate: amountPaid >= totalDue ? null : balanceDueDateFor(old.eventDate, settings.balanceDueDays),
      amountPaid: credit,
      collectionFee: old.collectionFee,
      status: "confirmed",
      paymentStatus: credit >= totalDue ? "paid" : "deposit_paid",
      replacementOfId: old.id,
    },
  });

  // Move the money trail from the old booking to the replacement
  const payments = await prisma.payments.findMany({ where: { allocations: { some: { bookingId: old.id } } } });
  for (const p of payments) {
    await prisma.payments.update({
      where: { id: p.id },
      data: { allocations: p.allocations.map((a) => (a.bookingId === old.id ? { ...a, bookingId: replacement.id } : a)) },
    });
  }
  await prisma.bookings.update({
    where: { id: old.id },
    data: { status: "replaced", resolution: "replaced", replacedById: replacement.id },
  });
  await ledger({ type: "credit_transfer", amount: credit, description: `Moved from cancelled booking ${old.id}`, bookingId: replacement.id });

  let refunded = 0;
  if (credit > totalDue) {
    refunded = await refundBooking(replacement.id, credit - totalDue, "Replacement is cheaper — difference refunded");
  }

  await notify({
    recipientId: service.sellerId,
    recipientType: "seller",
    title: "New booking (replacement)",
    message: `You have a new booking for ${service.title} on ${old.eventDate} at ${replacement.startTime} in ${old.eventDistrict}.`,
    link: `/bookings/${replacement.id}`,
    type: "booking",
    critical: true,
  });
  await notify({
    recipientId: old.userId,
    recipientType: "user",
    title: "Replacement booked",
    message:
      refunded > 0
        ? `${service.title} is booked. The replacement is cheaper, so ${formatRwf(refunded)} is being refunded.`
        : credit < totalDue
        ? `${service.title} is booked. Your payment was moved over; ${formatRwf(totalDue - credit)} remains to be paid before ${replacement.balanceDueDate}.`
        : `${service.title} is booked and fully paid with your existing payment.`,
    link: `/bookings/${replacement.id}`,
    critical: true,
  });
  return replacement;
};

// ───────────── Delivery, release and disputes ─────────────

export const markCompleted = async (bookingId: string, by: "provider" | "system") => {
  const b = await getBookingOr404(bookingId);
  if (b.status !== "confirmed") throw new ValidationError("Only confirmed bookings can be marked as delivered");
  if (kigaliToday() < b.eventDate) throw new ValidationError("You can mark the service as delivered on or after the event date");
  const settings = await getSettings();
  const releaseAt = new Date(Date.now() + settings.disputeWindowHours * 3600 * 1000);
  const updated = await prisma.bookings.update({
    where: { id: b.id },
    data: { status: "completed", completedAt: new Date(), releaseAt },
  });
  await notify({
    recipientId: b.userId,
    recipientType: "user",
    title: "How did it go?",
    message: `${b.serviceTitle} was marked as delivered${by === "system" ? " automatically after your event" : ""}. If everything went as agreed, confirm it. If something went wrong, report a problem within ${settings.disputeWindowHours} hours — after that the provider is paid.`,
    link: `/bookings/${b.id}`,
    type: "delivery",
    critical: true,
    sms: `Was ${b.serviceTitle} delivered as agreed? Confirm or report a problem in HUZA within ${settings.disputeWindowHours}h.`,
  });
  return updated;
};

export const confirmDelivery = async (bookingId: string) => {
  const b = await getBookingOr404(bookingId);
  if (b.status !== "completed") throw new ValidationError("This booking is not waiting for confirmation");
  await prisma.bookings.update({ where: { id: b.id }, data: { coupleConfirmed: true } });
  return settleBooking(b.id, true);
};

export const openDispute = async (
  bookingId: string,
  userId: string,
  input: { problemType: string; description: string; evidence?: any[] }
) => {
  const b = await getBookingOr404(bookingId);
  const preset = DISPUTE_PRESETS[input.problemType];
  if (!preset) throw new ValidationError("Choose what went wrong");
  if (!input.description || input.description.trim().length < 20) {
    throw new ValidationError("Please describe the problem (at least 20 characters)");
  }
  const eventPassed = kigaliToday() >= b.eventDate;
  const inWindow = b.status === "completed" && b.releaseAt && b.releaseAt > new Date();
  const confirmedAfterEvent = b.status === "confirmed" && eventPassed;
  if (!inWindow && !confirmedAfterEvent) {
    throw new ValidationError("Problems can only be reported after the event and before the provider is paid");
  }
  const dispute = await prisma.disputes.create({
    data: {
      bookingId: b.id,
      userId,
      sellerId: b.sellerId,
      problemType: input.problemType,
      description: input.description.trim(),
      evidence: input.evidence || [],
      proposedRefundPercent: preset.refundPercent,
    },
  });
  await prisma.bookings.update({ where: { id: b.id }, data: { status: "disputed" } });
  await notify({
    recipientId: b.sellerId,
    recipientType: "seller",
    title: "A problem was reported",
    message: `The couple reported "${preset.label}" for ${b.serviceTitle} on ${b.eventDate}. Payment is on hold until HUZA reviews it. You can add your response in the booking page.`,
    link: `/bookings/${b.id}`,
    critical: true,
  });
  await notifyAdmins("New dispute", `${preset.label} — ${b.serviceTitle} (${b.eventDate})`, `/disputes`);
  return dispute;
};

export const resolveDispute = async (disputeId: string, decision: "accept" | "reject", refundPercent?: number, note?: string) => {
  const d = await prisma.disputes.findUnique({ where: { id: disputeId } });
  if (!d || d.status !== "open") throw new ValidationError("Dispute not found or already resolved");
  const b = await getBookingOr404(d.bookingId);

  if (decision === "reject") {
    await prisma.disputes.update({ where: { id: d.id }, data: { status: "rejected", adminNote: note, resolvedAt: new Date(), resolvedRefundPercent: 0 } });
    await prisma.bookings.update({ where: { id: b.id }, data: { status: "completed" } });
    await settleBooking(b.id, true);
    await notify({ recipientId: b.userId, recipientType: "user", title: "Dispute reviewed", message: `After review, no refund applies for ${b.serviceTitle}.${note ? ` Note: ${note}` : ""}`, link: `/bookings/${b.id}` });
    return;
  }

  if (d.problemType === "no_show") {
    await prisma.disputes.update({ where: { id: d.id }, data: { status: "resolved", adminNote: note, resolvedAt: new Date(), resolvedRefundPercent: 100 } });
    await prisma.bookings.update({ where: { id: b.id }, data: { status: "confirmed" } });
    await cancelByProvider(b.id, { reasonCategory: "no_show", reason: note, noShow: true, initiatedBy: "admin" });
    return;
  }

  const pct = Math.max(0, Math.min(100, Math.round(refundPercent ?? d.proposedRefundPercent)));
  const refund = Math.round((servicePaid(b) * pct) / 100);
  const refunded = refund > 0 ? await refundBooking(b.id, refund, `Dispute: ${pct}% refund`) : 0;
  await prisma.disputes.update({ where: { id: d.id }, data: { status: "resolved", adminNote: note, resolvedAt: new Date(), resolvedRefundPercent: pct } });
  await prisma.bookings.update({ where: { id: b.id }, data: { status: "completed" } });
  await settleBooking(b.id, pct < 100);
  await notify({
    recipientId: b.userId,
    recipientType: "user",
    title: "Dispute resolved",
    message: `${formatRwf(refunded)} (${pct}%) is being refunded for ${b.serviceTitle}.${note ? ` Note: ${note}` : ""}`,
    link: `/bookings/${b.id}`,
    critical: true,
  });
  await notify({
    recipientId: b.sellerId,
    recipientType: "seller",
    title: "Dispute resolved",
    message: `The dispute for ${b.serviceTitle} was resolved with a ${pct}% refund to the couple. The rest of your earnings will be paid on Thursday.`,
    link: `/bookings/${b.id}`,
  });
};
