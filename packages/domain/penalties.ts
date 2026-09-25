/**
 * Provider cancellation fines. A fine starts "pending"; the provider has an
 * appeal window to upload evidence (e.g. a medical note). An admin waives or
 * confirms it; with no appeal it is confirmed automatically. Confirmed fines
 * add a strike and are deducted from future payouts.
 */
import prisma from "@packages/libs/prisma";
import { notify, notifyAdmins } from "@packages/libs/notify";
import { NO_SHOW_FINE_PERCENT, PROVIDER_FINE_TIERS, getSettings } from "@packages/utils/config";
import { daysUntil } from "@packages/utils/dates";
import { addStrike } from "./reliability";
import { formatRwf } from "./money";

export const finePercentFor = (daysBefore: number, noShow: boolean) => {
  if (noShow) return NO_SHOW_FINE_PERCENT;
  const tier = PROVIDER_FINE_TIERS.find((t) => daysBefore >= t.minDays) ?? PROVIDER_FINE_TIERS[PROVIDER_FINE_TIERS.length - 1];
  return tier.finePercent;
};

export const createCancellationPenalty = async (
  booking: { id: string; sellerId: string; price: number; eventDate: string; serviceTitle: string },
  noShow = false
) => {
  const settings = await getSettings();
  const days = daysUntil(booking.eventDate);
  const percent = finePercentFor(days, noShow);
  const amount = Math.round((booking.price * percent) / 100);
  const appealDeadline = new Date(Date.now() + settings.appealWindowDays * 24 * 3600 * 1000);
  const reason = noShow
    ? `No-show for ${booking.serviceTitle} on ${booking.eventDate}`
    : `Cancelled ${booking.serviceTitle} ${Math.max(0, days)} days before the event (${booking.eventDate})`;

  const penalty = await prisma.penalties.create({
    data: { sellerId: booking.sellerId, bookingId: booking.id, amount, reason, appealDeadline },
  });

  await notify({
    recipientId: booking.sellerId,
    recipientType: "seller",
    title: "Cancellation fine pending",
    message: `${reason}. A fine of ${formatRwf(amount)} (${percent}%) is pending. If this was an emergency, appeal with evidence before ${appealDeadline.toISOString().slice(0, 10)}. Without an appeal the fine is confirmed and counts as a strike.`,
    link: "/penalties",
    type: "penalty",
    critical: true,
    sms: `A cancellation fine of ${formatRwf(amount)} is pending. Appeal within ${settings.appealWindowDays} days in your HUZA dashboard.`,
  });
  return penalty;
};

export const confirmPenalty = async (penaltyId: string, note?: string) => {
  const penalty = await prisma.penalties.findUnique({ where: { id: penaltyId } });
  if (!penalty || !["pending", "appealed"].includes(penalty.status)) return penalty;
  const updated = await prisma.penalties.update({
    where: { id: penaltyId },
    data: { status: "confirmed", decisionNote: note, decidedAt: new Date() },
  });
  await addStrike(penalty.sellerId, penalty.reason, penalty.id);
  await notify({
    recipientId: penalty.sellerId,
    recipientType: "seller",
    title: "Fine confirmed",
    message: `The fine of ${formatRwf(penalty.amount)} was confirmed${note ? `: ${note}` : ""}. It will be deducted from your next payout(s).`,
    link: "/penalties",
    type: "penalty",
  });
  return updated;
};

/** Valid emergency: no fine and no strike (the cancellation is still recorded) */
export const waivePenalty = async (penaltyId: string, note?: string) => {
  const penalty = await prisma.penalties.findUnique({ where: { id: penaltyId } });
  if (!penalty || !["pending", "appealed"].includes(penalty.status)) return penalty;
  const updated = await prisma.penalties.update({
    where: { id: penaltyId },
    data: { status: "waived", decisionNote: note, decidedAt: new Date() },
  });
  await notify({
    recipientId: penalty.sellerId,
    recipientType: "seller",
    title: "Fine waived",
    message: `Your appeal was accepted and the fine of ${formatRwf(penalty.amount)} was waived${note ? `: ${note}` : ""}. No strike was added.`,
    link: "/penalties",
    type: "penalty",
  });
  return updated;
};

export const submitAppeal = async (penaltyId: string, text: string, evidence: any[]) => {
  const updated = await prisma.penalties.update({
    where: { id: penaltyId },
    data: { status: "appealed", appealText: text, appealEvidence: evidence },
  });
  await notifyAdmins("New fine appeal", `A provider appealed a fine of ${formatRwf(updated.amount)}.`, `/penalties`);
  return updated;
};

/** Cron: pending fines past their appeal deadline are confirmed */
export const autoConfirmExpiredPenalties = async () => {
  const due = await prisma.penalties.findMany({ where: { status: "pending", appealDeadline: { lt: new Date() } } });
  for (const p of due) await confirmPenalty(p.id, "No appeal was submitted in time");
  return due.length;
};
