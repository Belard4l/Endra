import { Response } from "express";
import prisma from "@packages/libs/prisma";
import { NotFoundError, ValidationError } from "@packages/error-handler";
import { uploadFile } from "@packages/libs/imagekit";
import { notifyAdmins } from "@packages/libs/notify";
import { cancelByProvider, markCompleted } from "@packages/domain/bookings";
import { finePercentFor, submitAppeal } from "@packages/domain/penalties";
import { payoutDestination } from "@packages/domain/payouts";
import { getSettings, STRIKE_LEVELS, STRIKE_WINDOW_MONTHS } from "@packages/utils/config";
import { daysUntil, kigaliToday } from "@packages/utils/dates";

const PROVIDER_CANCEL_REASONS = ["emergency", "illness", "schedule_conflict", "equipment_failure", "other"];

const loadOwn = async (req: any) => {
  const booking = await prisma.bookings.findFirst({ where: { id: req.params.id, sellerId: req.seller.id } });
  if (!booking) throw new NotFoundError("Booking not found");
  return booking;
};

/**
 * The event location is revealed ~2 weeks before the day, once the couple has
 * paid in full (5). Until then providers see only the district.
 */
const locationVisible = async (b: { eventDate: string; paymentStatus: string; status: string }) => {
  const settings = await getSettings();
  return (
    ["confirmed", "completed", "disputed", "released"].includes(b.status) &&
    b.paymentStatus === "paid" &&
    daysUntil(b.eventDate) <= settings.locationRevealDays
  );
};

const shape = async (b: any) => {
  const reveal = await locationVisible(b);
  const { eventLocation, notes, ...rest } = b;
  return {
    ...rest,
    eventLocation: reveal ? eventLocation : null,
    notes: reveal ? notes : null,
    locationRevealed: reveal,
    earningsEstimate: b.providerAmount,
  };
};

export const listBookings = async (req: any, res: Response) => {
  const { filter = "upcoming" } = req.query;
  const today = kigaliToday();
  const where: any = { sellerId: req.seller.id, status: { notIn: ["pending_payment", "expired", "replaced"] } };
  if (filter === "upcoming") Object.assign(where, { eventDate: { gte: today }, status: "confirmed" });
  else if (filter === "awaiting") where.status = { in: ["completed", "disputed"] };
  else if (filter === "past") where.status = { in: ["released", "cancelled_by_couple", "cancelled_by_provider"] };
  const bookings = await prisma.bookings.findMany({ where, orderBy: [{ eventDate: filter === "past" ? "desc" : "asc" }], take: 200 });
  res.json({ bookings: await Promise.all(bookings.map(shape)) });
};

export const bookingDetail = async (req: any, res: Response) => {
  const booking = await loadOwn(req);
  const isEventDay = kigaliToday() === booking.eventDate;
  const [couple, dispute, penalty] = await Promise.all([
    prisma.users.findUnique({ where: { id: booking.userId }, select: { name: true, phone: true } }),
    prisma.disputes.findFirst({ where: { bookingId: booking.id }, orderBy: { createdAt: "desc" } }),
    prisma.penalties.findFirst({ where: { bookingId: booking.id } }),
  ]);
  const days = daysUntil(booking.eventDate);
  res.json({
    booking: await shape(booking),
    couple: { firstName: couple?.name.split(" ")[0], ...(isEventDay ? { name: couple?.name, phone: couple?.phone } : {}) },
    chatOpen: isEventDay && ["confirmed", "completed"].includes(booking.status),
    canComplete: booking.status === "confirmed" && kigaliToday() >= booking.eventDate,
    cancelFinePercent: booking.status === "confirmed" ? finePercentFor(days, false) : null,
    cancelReasons: PROVIDER_CANCEL_REASONS,
    dispute: dispute && { ...dispute, evidence: undefined, evidenceCount: dispute.evidence.length },
    penalty,
  });
};

export const cancel = async (req: any, res: Response) => {
  const booking = await loadOwn(req);
  if (booking.status !== "confirmed") throw new ValidationError("Only upcoming bookings can be cancelled");
  const { reasonCategory, reason, evidence } = req.body;
  if (!PROVIDER_CANCEL_REASONS.includes(reasonCategory)) throw new ValidationError("Choose a reason");
  if (!reason || String(reason).trim().length < 10) throw new ValidationError("Explain what happened (at least 10 characters)");
  const files = [];
  for (const f of Array.isArray(evidence) ? evidence.slice(0, 5) : []) {
    if (typeof f === "string" && f.startsWith("data:")) files.push(await uploadFile(f, "cancellation-evidence", "cancellations", true));
  }
  await cancelByProvider(booking.id, { reasonCategory, reason: String(reason).trim(), evidence: files });
  res.json({ success: true, message: "The booking was cancelled. The couple has been offered alternatives or a refund. A fine is pending — you can appeal it with evidence." });
};

export const complete = async (req: any, res: Response) => {
  const booking = await loadOwn(req);
  const updated = await markCompleted(booking.id, "provider");
  res.json({ booking: await shape(updated) });
};

export const respondToDispute = async (req: any, res: Response) => {
  const booking = await loadOwn(req);
  const dispute = await prisma.disputes.findFirst({ where: { bookingId: booking.id, status: "open" } });
  if (!dispute) throw new ValidationError("There is no open dispute on this booking");
  const response = String(req.body.response || "").trim();
  if (response.length < 10) throw new ValidationError("Please write a response (at least 10 characters)");
  await prisma.disputes.update({ where: { id: dispute.id }, data: { providerResponse: response.slice(0, 2000) } });
  await notifyAdmins("Provider responded to a dispute", `${booking.serviceTitle} (${booking.eventDate})`, "/disputes");
  res.json({ success: true });
};

export const dashboard = async (req: any, res: Response) => {
  const sellerId = req.seller.id;
  const today = kigaliToday();
  const [upcoming, awaiting, released, unpaid, fines, questions, services, recent] = await Promise.all([
    prisma.bookings.count({ where: { sellerId, status: "confirmed", eventDate: { gte: today } } }),
    prisma.bookings.findMany({ where: { sellerId, status: { in: ["completed", "disputed"] } }, select: { price: true } }),
    prisma.bookings.aggregate({ where: { sellerId, payoutId: { not: null } }, _sum: { providerAmount: true } }),
    prisma.bookings.aggregate({ where: { sellerId, releasedAt: { not: null }, payoutId: null }, _sum: { providerAmount: true } }),
    prisma.penalties.findMany({ where: { sellerId, status: { in: ["pending", "appealed", "confirmed"] } } }),
    prisma.questions.count({ where: { sellerId, answer: null, isHidden: false } }),
    prisma.services.groupBy({ by: ["status"], where: { sellerId, isDeleted: false }, _count: true }),
    prisma.bookings.findMany({
      where: { sellerId, status: { notIn: ["pending_payment", "expired", "replaced"] } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);
  const seller = await prisma.sellers.findUnique({ where: { id: sellerId } });
  const monthly: Record<string, number> = {};
  const releasedList = await prisma.bookings.findMany({
    where: { sellerId, releasedAt: { gte: new Date(Date.now() - 180 * 24 * 3600 * 1000) } },
    select: { releasedAt: true, providerAmount: true },
  });
  releasedList.forEach((b) => {
    const key = b.releasedAt!.toISOString().slice(0, 7);
    monthly[key] = (monthly[key] || 0) + b.providerAmount;
  });

  res.json({
    stats: {
      upcomingBookings: upcoming,
      awaitingRelease: awaiting.length,
      nextPayout: unpaid._sum.providerAmount || 0,
      paidOut: released._sum.providerAmount || 0,
      outstandingFines: fines.filter((f) => f.status === "confirmed").reduce((s, f) => s + f.amount - f.deductedAmount, 0),
      pendingFines: fines.filter((f) => f.status !== "confirmed").length,
      unansweredQuestions: questions,
      completedWeddings: seller?.completedCount || 0,
      visibilityScore: seller?.visibilityScore || 0,
      activeStrikes: seller?.activeStrikes || 0,
      status: seller?.status,
      verificationStatus: seller?.verificationStatus,
      hasPayoutMethod: Boolean(seller && payoutDestination(seller)),
      services: Object.fromEntries(services.map((s) => [s.status, s._count])),
    },
    monthlyEarnings: Object.entries(monthly).sort().map(([month, amount]) => ({ month, amount })),
    recent: await Promise.all(recent.map(shape)),
    strikeRules: { windowMonths: STRIKE_WINDOW_MONTHS, levels: STRIKE_LEVELS },
  });
};

export const payouts = async (req: any, res: Response) => {
  const sellerId = req.seller.id;
  const [list, pending, ledger] = await Promise.all([
    prisma.payouts.findMany({ where: { sellerId }, orderBy: { createdAt: "desc" }, take: 52 }),
    prisma.bookings.findMany({
      where: { sellerId, releasedAt: { not: null }, payoutId: null, providerAmount: { gt: 0 } },
      select: { id: true, serviceTitle: true, eventDate: true, providerAmount: true, releasedAt: true },
    }),
    prisma.ledgerEntries.findMany({ where: { sellerId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const onHold = await prisma.bookings.findMany({
    where: { sellerId, status: { in: ["confirmed", "completed", "disputed"] } },
    select: { id: true, serviceTitle: true, eventDate: true, status: true, price: true, amountPaid: true, releaseAt: true },
    orderBy: { eventDate: "asc" },
  });
  res.json({ payouts: list, readyForThursday: pending, onHold, ledger });
};

export const penalties = async (req: any, res: Response) => {
  const sellerId = req.seller.id;
  const [list, strikes] = await Promise.all([
    prisma.penalties.findMany({ where: { sellerId }, orderBy: { createdAt: "desc" } }),
    prisma.strikes.findMany({ where: { sellerId }, orderBy: { createdAt: "desc" } }),
  ]);
  res.json({
    penalties: list.map((p) => ({ ...p, appealEvidence: p.appealEvidence.map((e) => ({ name: e.name })) })),
    strikes: strikes.map((s) => ({ ...s, active: s.expiresAt > new Date() })),
    rules: { windowMonths: STRIKE_WINDOW_MONTHS, levels: STRIKE_LEVELS },
  });
};

export const appeal = async (req: any, res: Response) => {
  const penalty = await prisma.penalties.findFirst({ where: { id: req.params.id, sellerId: req.seller.id } });
  if (!penalty) throw new NotFoundError("Fine not found");
  if (penalty.status !== "pending") throw new ValidationError("This fine can no longer be appealed");
  if (penalty.appealDeadline < new Date()) throw new ValidationError("The appeal window has closed");
  const text = String(req.body.text || "").trim();
  if (text.length < 30) throw new ValidationError("Explain the emergency in at least 30 characters");
  const files = [];
  for (const f of Array.isArray(req.body.evidence) ? req.body.evidence.slice(0, 5) : []) {
    if (typeof f === "string" && f.startsWith("data:")) files.push(await uploadFile(f, "appeal-evidence", "appeals", true));
  }
  if (files.length === 0) throw new ValidationError("Upload at least one piece of evidence (e.g. medical note, police report)");
  const updated = await submitAppeal(penalty.id, text, files);
  res.json({ penalty: updated });
};
