/**
 * Scheduled work (Africa/Kigali time):
 *  every 5 min  – release checkout holds that were never paid
 *  hourly       – auto-mark delivered after the event, release payments after
 *                 the dispute window, confirm fines whose appeal window closed,
 *                 refund couples who didn't pick a replacement in time
 *  daily 08:00  – balance reminders, cancel bookings whose balance is overdue,
 *                 expire old strikes
 *  Thu 09:00    – weekly payouts
 */
import cron from "node-cron";
import prisma from "@packages/libs/prisma";
import { notify } from "@packages/libs/notify";
import { cancelByCouple, chooseRefund, markCompleted } from "@packages/domain/bookings";
import { settleBooking, formatRwf } from "@packages/domain/money";
import { autoConfirmExpiredPenalties } from "@packages/domain/penalties";
import { runWeeklyPayouts } from "@packages/domain/payouts";
import { evaluateSellerStatus } from "@packages/domain/reliability";
import { addDays, kigaliToday } from "@packages/utils/dates";

const TZ = { timezone: "Africa/Kigali" };

const safely = (name: string, fn: () => Promise<unknown>) => async () => {
  try {
    await fn();
  } catch (err) {
    console.error(`[booking-jobs] ${name} failed`, err);
  }
};

export const expireHolds = async () => {
  const r = await prisma.bookings.updateMany({
    where: { status: "pending_payment", holdExpiresAt: { lt: new Date() } },
    data: { status: "expired" },
  });
  if (r.count) console.log(`[booking-jobs] expired ${r.count} unpaid holds`);
};

export const autoCompleteAndRelease = async () => {
  const today = kigaliToday();
  // Provider forgot to mark delivered: do it the day after the event (fully paid only)
  const overdue = await prisma.bookings.findMany({
    where: { status: "confirmed", eventDate: { lt: today }, paymentStatus: "paid" },
  });
  for (const b of overdue) await markCompleted(b.id, "system").catch((e) => console.error(e.message));

  // Dispute window passed with no dispute → release to the Thursday payout
  const due = await prisma.bookings.findMany({ where: { status: "completed", releaseAt: { lt: new Date() }, releasedAt: null } });
  for (const b of due) await settleBooking(b.id, true);
};

export const resolveReplacementTimeouts = async () => {
  const late = await prisma.bookings.findMany({
    where: { status: "cancelled_by_provider", resolution: "awaiting_choice", resolutionDeadline: { lt: new Date() } },
  });
  for (const b of late) await chooseRefund(b.id).catch((e) => console.error(e.message));
};

export const balanceReminders = async () => {
  const today = kigaliToday();
  const soon = addDays(today, 3);
  const dueSoon = await prisma.bookings.findMany({
    where: { status: "confirmed", paymentStatus: "deposit_paid", balanceDueDate: { lte: soon, gte: today }, balanceReminderSent: false },
  });
  for (const b of dueSoon) {
    const remaining = b.price + b.bookingFee - (b.amountPaid - b.refundedAmount);
    await notify({
      recipientId: b.userId,
      recipientType: "user",
      title: "Balance due soon",
      message: `${formatRwf(remaining)} is due by ${b.balanceDueDate} for ${b.serviceTitle} (${b.eventDate}). If it isn't paid, the booking is cancelled under the cancellation policy.`,
      link: `/bookings/${b.id}`,
      type: "payment",
      critical: true,
      sms: `Reminder: ${formatRwf(remaining)} due by ${b.balanceDueDate} for your ${b.category} booking.`,
    });
    await prisma.bookings.update({ where: { id: b.id }, data: { balanceReminderSent: true } });
  }

  const overdue = await prisma.bookings.findMany({
    where: { status: "confirmed", paymentStatus: "deposit_paid", balanceDueDate: { lt: today } },
  });
  for (const b of overdue) {
    await cancelByCouple(b.id, "Balance was not paid by the due date", true).catch((e) => console.error(e.message));
  }
};

export const expireStrikes = async () => {
  const sellers = await prisma.sellers.findMany({ where: { activeStrikes: { gt: 0 } }, select: { id: true } });
  for (const s of sellers) await evaluateSellerStatus(s.id);
};

export const startBookingJobs = () => {
  cron.schedule("*/5 * * * *", safely("expire-holds", expireHolds), TZ);
  cron.schedule("10 * * * *", safely("complete-release", autoCompleteAndRelease), TZ);
  cron.schedule("20 * * * *", safely("replacement-timeouts", resolveReplacementTimeouts), TZ);
  cron.schedule("30 * * * *", safely("penalty-auto-confirm", autoConfirmExpiredPenalties), TZ);
  cron.schedule("0 8 * * *", safely("balance", balanceReminders), TZ);
  cron.schedule("30 2 * * *", safely("strikes", expireStrikes), TZ);
  // Every Thursday — no holiday exceptions, no minimum amount
  cron.schedule("0 9 * * 4", safely("weekly-payouts", () => runWeeklyPayouts()), TZ);
  console.log("[booking-jobs] scheduled (payouts every Thursday 09:00 Kigali time)");
};
