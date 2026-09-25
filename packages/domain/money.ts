/**
 * Money movements: confirming payments, refunds, and settling a booking's
 * earnings (85% provider / 15% HUZA after the shared collection fee).
 * Every movement is written to the ledger.
 */
import prisma from "@packages/libs/prisma";
import { notify, notifyAdmins } from "@packages/libs/notify";
import { refundTransaction } from "@packages/libs/flutterwave";
import { getSettings } from "@packages/utils/config";
import { splitEarnings } from "@packages/utils/pricing";
import { checkAvailability } from "./availability";
import { recomputeVisibility } from "./reliability";

export const ledger = (data: {
  type: string;
  amount: number;
  description: string;
  sellerId?: string | null;
  bookingId?: string | null;
  paymentId?: string | null;
  payoutId?: string | null;
}) => prisma.ledgerEntries.create({ data: { ...data, amount: Math.round(data.amount) } });

export const formatRwf = (n: number) => `${Math.round(n).toLocaleString("en-US")} RWF`;

const paymentStatusFor = (b: { amountPaid: number; price: number; bookingFee: number; refundedAmount: number }) => {
  if (b.refundedAmount > 0 && b.refundedAmount >= b.amountPaid) return "refunded";
  if (b.refundedAmount > 0) return "partially_refunded";
  if (b.amountPaid >= b.price + b.bookingFee) return "paid";
  if (b.amountPaid > 0) return "deposit_paid";
  return "unpaid";
};

/**
 * Applies a verified successful payment. Idempotent — safe to call from both
 * the webhook and the redirect callback.
 */
export const applyPaymentSuccess = async (
  paymentId: string,
  verified: { flwTransactionId: string; amount: number; fee: number }
) => {
  const payment = await prisma.payments.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status === "successful") return payment;
  if (verified.amount < payment.amount) {
    await prisma.payments.update({ where: { id: paymentId }, data: { status: "failed" } });
    await notifyAdmins(
      "Underpaid transaction",
      `Payment ${payment.txRef} expected ${formatRwf(payment.amount)} but received ${formatRwf(verified.amount)}.`
    );
    return payment;
  }

  const updated = await prisma.payments.update({
    where: { id: paymentId },
    data: { status: "successful", fee: verified.fee, flwTransactionId: verified.flwTransactionId },
  });

  for (const alloc of payment.allocations) {
    const booking = await prisma.bookings.findUnique({ where: { id: alloc.bookingId } });
    if (!booking) continue;
    const feeShare = payment.amount > 0 ? Math.round((verified.fee * alloc.amount) / payment.amount) : 0;
    const amountPaid = booking.amountPaid + alloc.amount;

    let status = booking.status;
    if (booking.status === "pending_payment") status = "confirmed";
    if (booking.status === "expired") {
      // Payment arrived after the hold ran out: confirm only if the date is still free
      const slot = await checkAvailability(booking.sellerId, booking.eventDate, { excludeBookingId: booking.id });
      status = slot.available ? "confirmed" : "expired";
    }

    const next = await prisma.bookings.update({
      where: { id: booking.id },
      data: {
        amountPaid,
        collectionFee: booking.collectionFee + feeShare,
        status,
        holdExpiresAt: null,
        paymentStatus: paymentStatusFor({ ...booking, amountPaid }),
      },
    });
    await ledger({
      type: "payment_received",
      amount: alloc.amount,
      description: `${payment.purpose} payment ${payment.txRef}`,
      bookingId: booking.id,
      sellerId: booking.sellerId,
      paymentId,
    });
    if (feeShare > 0) {
      await ledger({
        type: "collection_fee",
        amount: -feeShare,
        description: "Processor collection fee",
        bookingId: booking.id,
        paymentId,
      });
    }

    if (next.status === "expired") {
      await refundBooking(next.id, alloc.amount, "Payment arrived after the slot was taken");
      await notify({
        recipientId: booking.userId,
        recipientType: "user",
        title: "Payment refunded",
        message: `Your payment for ${booking.serviceTitle} arrived after the date was taken by another couple, so it has been refunded.`,
        link: `/bookings/${booking.id}`,
        critical: true,
      });
      continue;
    }

    if (payment.purpose === "initial" || booking.status !== "confirmed") {
      await notify({
        recipientId: booking.userId,
        recipientType: "user",
        title: "Booking confirmed",
        message: `${booking.serviceTitle} is booked for ${booking.eventDate} at ${booking.startTime}. Paid so far: ${formatRwf(amountPaid)}.`,
        link: `/bookings/${booking.id}`,
        type: "booking",
        critical: true,
        sms: `Booking confirmed: ${booking.serviceTitle} on ${booking.eventDate}.`,
      });
      await notify({
        recipientId: booking.sellerId,
        recipientType: "seller",
        title: "New booking",
        message: `You have a new booking for ${booking.serviceTitle} on ${booking.eventDate} at ${booking.startTime} in ${booking.eventDistrict}.`,
        link: `/bookings/${booking.id}`,
        type: "booking",
        critical: true,
        sms: `New booking: ${booking.serviceTitle} on ${booking.eventDate}.`,
      });
      await prisma.userEvents.create({
        data: { userId: booking.userId, action: "book", serviceId: booking.serviceId, sellerId: booking.sellerId, category: booking.category },
      });
    } else {
      await notify({
        recipientId: booking.userId,
        recipientType: "user",
        title: "Payment received",
        message: `We received ${formatRwf(alloc.amount)} for ${booking.serviceTitle}.`,
        link: `/bookings/${booking.id}`,
        type: "payment",
      });
    }
  }
  return updated;
};

/**
 * Refunds up to `amount` of what the couple paid for a booking, newest
 * payment first. Returns how much was actually refunded.
 */
export const refundBooking = async (bookingId: string, amount: number, reason: string): Promise<number> => {
  const booking = await prisma.bookings.findUnique({ where: { id: bookingId } });
  if (!booking || amount <= 0) return 0;
  const refundable = Math.min(Math.round(amount), booking.amountPaid - booking.refundedAmount);
  if (refundable <= 0) return 0;

  const payments = await prisma.payments.findMany({
    where: { status: "successful", allocations: { some: { bookingId } } },
    orderBy: { createdAt: "desc" },
  });

  let remaining = refundable;
  let refunded = 0;
  for (const p of payments) {
    if (remaining <= 0) break;
    const alloc = p.allocations.find((a) => a.bookingId === bookingId);
    if (!alloc || !p.flwTransactionId) continue;
    const available = Math.min(alloc.amount, p.amount - p.refunded);
    const part = Math.min(available, remaining);
    if (part <= 0) continue;
    const res = await refundTransaction(p.flwTransactionId, part);
    if (!res.ok) {
      await ledger({ type: "refund_failed", amount: 0, description: `${reason}: ${(res as any).error}`, bookingId, paymentId: p.id });
      await notifyAdmins(
        "Refund needs attention",
        `Automatic refund of ${formatRwf(part)} for booking ${bookingId} failed: ${(res as any).error}. Refund it manually in the Flutterwave dashboard.`,
        `/bookings/${bookingId}`
      );
      continue;
    }
    await prisma.payments.update({ where: { id: p.id }, data: { refunded: p.refunded + part } });
    await ledger({ type: "refund", amount: -part, description: reason, bookingId, paymentId: p.id });
    remaining -= part;
    refunded += part;
  }

  if (refunded > 0) {
    const refundedAmount = booking.refundedAmount + refunded;
    await prisma.bookings.update({
      where: { id: bookingId },
      data: { refundedAmount, paymentStatus: paymentStatusFor({ ...booking, refundedAmount }) },
    });
  }
  return refunded;
};

/**
 * Works out what the provider earns from a booking and marks it ready for the
 * next Thursday payout. `delivered` is false for couple cancellations, where
 * the provider keeps the non-refunded share but it doesn't count as a wedding
 * delivered.
 */
export const settleBooking = async (bookingId: string, delivered: boolean) => {
  const booking = await prisma.bookings.findUnique({ where: { id: bookingId } });
  if (!booking || booking.releasedAt) return booking;
  const settings = await getSettings();

  const kept = booking.amountPaid - booking.refundedAmount;
  const feeOnService = booking.amountPaid > 0 ? Math.round((booking.collectionFee * (booking.amountPaid - booking.bookingFee)) / booking.amountPaid) : 0;
  const net = Math.max(0, kept - booking.bookingFee - Math.max(0, feeOnService));
  const { provider, platform } = splitEarnings(net, settings.commissionPercent);

  const updated = await prisma.bookings.update({
    where: { id: bookingId },
    data: {
      providerAmount: provider,
      platformAmount: platform,
      releasedAt: new Date(),
      ...(delivered ? { status: "released" } : {}),
    },
  });

  await ledger({ type: "provider_earning", amount: provider, description: "Provider share (85% after fees)", bookingId, sellerId: booking.sellerId });
  await ledger({ type: "platform_commission", amount: platform, description: `HUZA commission (${settings.commissionPercent}%)`, bookingId });
  if (booking.bookingFee > 0 && kept >= booking.bookingFee) {
    await ledger({ type: "booking_fee", amount: booking.bookingFee, description: "Booking fee (covers payout costs)", bookingId });
  }

  if (delivered) {
    await prisma.sellers.update({ where: { id: booking.sellerId }, data: { completedCount: { increment: 1 } } });
    await prisma.services.update({ where: { id: booking.serviceId }, data: { bookingsCount: { increment: 1 } } }).catch(() => null);
    await recomputeVisibility(booking.sellerId);
  }

  if (provider > 0) {
    await notify({
      recipientId: booking.sellerId,
      recipientType: "seller",
      title: "Earnings released",
      message: `${formatRwf(provider)} from ${booking.serviceTitle} (${booking.eventDate}) will be paid on the next Thursday payout.`,
      link: "/payouts",
      type: "payout",
    });
  }
  return updated;
};
