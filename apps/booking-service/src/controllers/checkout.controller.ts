import { Response } from "express";
import prisma from "@packages/libs/prisma";
import { withLock } from "@packages/libs/redis";
import { NotFoundError, ValidationError } from "@packages/error-handler";
import { checkAvailability } from "@packages/domain/availability";
import { applyPaymentSuccess } from "@packages/domain/money";
import { balanceDueDateFor } from "@packages/domain/bookings";
import {
  initiatePayment,
  isMockMode,
  isValidWebhook,
  verifyByReference,
  verifyTransaction,
} from "@packages/libs/flutterwave";
import { handleTransferEvent } from "@packages/domain/payouts";
import { CHECKOUT_HOLD_MINUTES, RWANDA_DISTRICTS, getSettings } from "@packages/utils/config";
import { daysUntil, isValidDateString, isValidTime } from "@packages/utils/dates";
import { calculatePrice } from "@packages/utils/pricing";
import { randomId } from "@packages/utils/slug";

const USER_UI = () => process.env.USER_UI_URL || "http://localhost:3000";

type CheckoutItem = {
  serviceId: string;
  eventDate: string;
  startTime: string;
  endTime?: string;
  selections?: { groupId: string; choiceIds: string[] }[];
  notes?: string;
};

/**
 * POST /checkout
 * Creates one booking per basket item (held for 20 minutes), then one
 * Flutterwave payment for the amount due now (deposit or full, per the
 * couple's choice), and returns the hosted payment link.
 */
export const checkout = async (req: any, res: Response) => {
  const user = req.user;
  const { items, paymentPlan, eventLocation, eventDistrict, phone } = req.body as {
    items: CheckoutItem[];
    paymentPlan: "full" | "deposit";
    eventLocation: string;
    eventDistrict: string;
    phone?: string;
  };
  if (!Array.isArray(items) || items.length === 0) throw new ValidationError("Your basket is empty");
  if (items.length > 15) throw new ValidationError("Too many items in one checkout");
  if (!["full", "deposit"].includes(paymentPlan)) throw new ValidationError("Choose full payment or deposit");
  if (!eventLocation || String(eventLocation).trim().length < 5) throw new ValidationError("Enter the event location (venue name and address)");
  if (!RWANDA_DISTRICTS.includes(eventDistrict)) throw new ValidationError("Choose the event district");
  if (phone && !user.phone) {
    await prisma.users.update({ where: { id: user.id }, data: { phone: String(phone).replace(/\s/g, "") } });
  }

  const settings = await getSettings();
  const holdExpiresAt = new Date(Date.now() + CHECKOUT_HOLD_MINUTES * 60 * 1000);
  const created: { id: string; dueNow: number }[] = [];

  try {
    for (const item of items) {
      if (!isValidDateString(item.eventDate)) throw new ValidationError("Every item needs a valid event date");
      if (!isValidTime(item.startTime)) throw new ValidationError("Every item needs a start time");
      const service = await prisma.services.findUnique({ where: { id: item.serviceId } });
      if (!service || service.status !== "published" || service.isDeleted) {
        throw new ValidationError("One of the services in your basket is no longer available");
      }
      if (service.serviceArea.length && !service.serviceArea.includes(eventDistrict) && service.travelFee === 0) {
        throw new ValidationError(`${service.title} does not travel to ${eventDistrict}`);
      }
      const priced = calculatePrice(service, item.selections || [], eventDistrict, service.serviceArea);
      const days = daysUntil(item.eventDate);
      // A deposit only makes sense if the balance can be paid before the due date
      const plan = paymentPlan === "deposit" && days > settings.balanceDueDays ? "deposit" : "full";
      const deposit = plan === "deposit" ? Math.round((priced.price * settings.depositPercent) / 100) : priced.price;
      const dueNow = deposit + settings.bookingFee;

      // Lock the provider's day so two couples can't take the last slot at once
      const booking = await withLock(`slot:${service.sellerId}:${item.eventDate}`, 15, async () => {
        const slot = await checkAvailability(service.sellerId, item.eventDate);
        if (!slot.available) throw new ValidationError(`${service.title} on ${item.eventDate}: ${slot.reason}`);
        return prisma.bookings.create({
          data: {
            userId: user.id,
            sellerId: service.sellerId,
            shopId: service.shopId,
            serviceId: service.id,
            serviceTitle: service.title,
            serviceImage: service.images[0]?.url,
            category: service.category,
            eventDate: item.eventDate,
            startTime: item.startTime,
            endTime: item.endTime && isValidTime(item.endTime) ? item.endTime : null,
            eventLocation: String(eventLocation).trim(),
            eventDistrict,
            notes: item.notes ? String(item.notes).slice(0, 500) : null,
            selectedOptions: priced.selectedOptions,
            basePrice: service.basePrice,
            optionsTotal: priced.optionsTotal,
            travelFee: priced.travelFee,
            price: priced.price,
            bookingFee: settings.bookingFee,
            paymentPlan: plan,
            depositAmount: deposit,
            balanceDueDate: plan === "deposit" ? balanceDueDateFor(item.eventDate, settings.balanceDueDays) : null,
            status: "pending_payment",
            holdExpiresAt,
          },
        });
      });
      created.push({ id: booking.id, dueNow });
    }
  } catch (err) {
    // Release any holds created before the failure
    if (created.length) {
      await prisma.bookings.updateMany({ where: { id: { in: created.map((c) => c.id) } }, data: { status: "expired", holdExpiresAt: null } });
    }
    throw err;
  }

  const total = created.reduce((s, c) => s + c.dueNow, 0);
  const order = await prisma.orders.create({
    data: {
      userId: user.id,
      paymentPlan,
      eventLocation: String(eventLocation).trim(),
      eventDistrict,
      totalAmount: total,
      bookingIds: created.map((c) => c.id),
    },
  });
  await prisma.bookings.updateMany({ where: { id: { in: created.map((c) => c.id) } }, data: { orderId: order.id } });

  const txRef = `HUZA-${Date.now()}-${randomId(3)}`;
  const link = await initiatePayment({
    txRef,
    amount: total,
    redirectUrl: `${USER_UI()}/checkout/callback`,
    customer: { email: user.email, name: user.name, phone: user.phone || phone },
    title: "HUZA wedding booking",
    description: `${created.length} service(s)`,
  });
  const payment = await prisma.payments.create({
    data: {
      userId: user.id,
      txRef,
      purpose: "initial",
      amount: total,
      paymentLink: link,
      allocations: created.map((c) => ({ bookingId: c.id, amount: c.dueNow })),
    },
  });

  res.status(201).json({ paymentLink: link, txRef: payment.txRef, orderId: order.id, amount: total, holdMinutes: CHECKOUT_HOLD_MINUTES, mock: isMockMode });
};

/** POST /bookings/:id/pay-balance — pays what's left (balance or replacement top-up) */
export const payBalance = async (req: any, res: Response) => {
  const booking = await prisma.bookings.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!booking) throw new NotFoundError("Booking not found");
  if (booking.status !== "confirmed") throw new ValidationError("This booking has nothing to pay");
  const remaining = booking.price + booking.bookingFee - (booking.amountPaid - booking.refundedAmount);
  if (remaining <= 0) throw new ValidationError("This booking is fully paid");

  const txRef = `HUZA-BAL-${Date.now()}-${randomId(3)}`;
  const link = await initiatePayment({
    txRef,
    amount: remaining,
    redirectUrl: `${USER_UI()}/checkout/callback`,
    customer: { email: req.user.email, name: req.user.name, phone: req.user.phone },
    title: "HUZA balance payment",
    description: booking.serviceTitle,
  });
  await prisma.payments.create({
    data: {
      userId: req.user.id,
      txRef,
      purpose: booking.replacementOfId ? "topup" : "balance",
      amount: remaining,
      paymentLink: link,
      allocations: [{ bookingId: booking.id, amount: remaining }],
    },
  });
  res.status(201).json({ paymentLink: link, txRef, amount: remaining, mock: isMockMode });
};

/**
 * GET /payments/verify?tx_ref=…&transaction_id=…
 * Called by the couple's browser after Flutterwave redirects back.
 */
export const verifyPayment = async (req: any, res: Response) => {
  const txRef = String(req.query.tx_ref || "");
  const payment = await prisma.payments.findFirst({ where: { txRef, userId: req.user.id } });
  if (!payment) throw new NotFoundError("Payment not found");
  if (payment.status === "successful") return res.json({ status: "successful", payment });
  if (isMockMode) return res.json({ status: payment.status, payment });

  const verified = req.query.transaction_id
    ? await verifyTransaction(String(req.query.transaction_id)).catch(() => null)
    : await verifyByReference(txRef);
  if (!verified || verified.txRef !== txRef) return res.json({ status: "pending" });
  if (verified.status === "successful" && verified.currency === "RWF") {
    await applyPaymentSuccess(payment.id, { flwTransactionId: verified.id, amount: verified.amount, fee: verified.fee });
    return res.json({ status: "successful" });
  }
  if (verified.status === "failed") {
    await prisma.payments.update({ where: { id: payment.id }, data: { status: "failed" } });
  }
  res.json({ status: verified.status });
};

/** POST /payments/mock-complete — only exists while Flutterwave keys are missing */
export const mockComplete = async (req: any, res: Response) => {
  if (!isMockMode) throw new NotFoundError("Not available");
  const payment = await prisma.payments.findFirst({ where: { txRef: String(req.body.txRef || ""), userId: req.user.id } });
  if (!payment) throw new NotFoundError("Payment not found");
  if (req.body.outcome === "fail") {
    await prisma.payments.update({ where: { id: payment.id }, data: { status: "failed" } });
    return res.json({ status: "failed" });
  }
  // Simulate Flutterwave's ~3.5% MoMo fee so the money maths can be tested
  const fee = Math.round(payment.amount * 0.035);
  await applyPaymentSuccess(payment.id, { flwTransactionId: `mock-${payment.txRef}`, amount: payment.amount, fee });
  res.json({ status: "successful" });
};

/** POST /webhooks/flutterwave — payments and transfer results */
export const flutterwaveWebhook = async (req: any, res: Response) => {
  if (!isValidWebhook(req.headers["verif-hash"] as string | undefined)) {
    return res.status(401).json({ message: "Invalid signature" });
  }
  const event = req.body?.event || req.body?.["event.type"];
  const data = req.body?.data || req.body?.transfer;
  // Acknowledge quickly; Flutterwave retries on non-200
  res.status(200).json({ received: true });

  try {
    if (event === "charge.completed" && data?.tx_ref) {
      const payment = await prisma.payments.findUnique({ where: { txRef: data.tx_ref } });
      if (!payment || payment.status === "successful") return;
      // Never trust the webhook body alone — verify with the API
      const verified = await verifyTransaction(String(data.id));
      if (verified.status === "successful" && verified.txRef === payment.txRef && verified.currency === "RWF") {
        await applyPaymentSuccess(payment.id, { flwTransactionId: verified.id, amount: verified.amount, fee: verified.fee });
      } else if (verified.status === "failed") {
        await prisma.payments.update({ where: { id: payment.id }, data: { status: "failed" } });
      }
    } else if (event === "transfer.completed" || String(event).toLowerCase() === "transfer") {
      await handleTransferEvent(data);
    }
  } catch (err) {
    console.error("[webhook] processing failed", err);
  }
};
