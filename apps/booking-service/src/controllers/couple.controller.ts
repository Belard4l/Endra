import { Response } from "express";
import prisma from "@packages/libs/prisma";
import { NotFoundError, ValidationError } from "@packages/error-handler";
import { uploadFile } from "@packages/libs/imagekit";
import { findAlternatives } from "@packages/domain/availability";
import {
  cancelByCouple,
  chooseRefund,
  chooseReplacement,
  confirmDelivery,
  coupleCancellationQuote,
  openDispute,
  rescheduleBooking,
} from "@packages/domain/bookings";
import { recomputeVisibility } from "@packages/domain/reliability";
import { COUPLE_CANCELLATION_TIERS, DISPUTE_PRESETS } from "@packages/utils/config";
import { isValidDateString, isValidTime, kigaliToday } from "@packages/utils/dates";

const loadOwn = async (req: any) => {
  const booking = await prisma.bookings.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!booking) throw new NotFoundError("Booking not found");
  return booking;
};

const uploadEvidence = async (files: unknown, folder: string) => {
  const list = Array.isArray(files) ? files.slice(0, 5) : [];
  const out = [];
  for (const f of list) {
    if (typeof f === "string" && f.startsWith("data:")) out.push(await uploadFile(f, "evidence", folder, true));
  }
  return out;
};

export const myBookings = async (req: any, res: Response) => {
  const bookings = await prisma.bookings.findMany({
    where: { userId: req.user.id, status: { notIn: ["expired"] } },
    orderBy: [{ eventDate: "asc" }, { startTime: "asc" }],
  });
  const shops = await prisma.shops.findMany({
    where: { id: { in: [...new Set(bookings.map((b) => b.shopId))] } },
    select: { id: true, name: true, avatar: true },
  });
  const byId = new Map(shops.map((s) => [s.id, s]));
  const today = kigaliToday();
  const active = bookings.filter((b) => ["confirmed", "completed", "disputed", "released"].includes(b.status));
  res.json({
    bookings: bookings.map((b) => ({ ...b, shop: byId.get(b.shopId) || null })),
    stats: {
      upcoming: active.filter((b) => b.eventDate >= today && b.status === "confirmed").length,
      total: active.length,
      balanceDue: active
        .filter((b) => b.status === "confirmed")
        .reduce((s, b) => s + Math.max(0, b.price + b.bookingFee - (b.amountPaid - b.refundedAmount)), 0),
    },
  });
};

export const bookingDetail = async (req: any, res: Response) => {
  const booking = await loadOwn(req);
  const [shop, seller, dispute, cancellation, review] = await Promise.all([
    prisma.shops.findUnique({ where: { id: booking.shopId } }),
    prisma.sellers.findUnique({ where: { id: booking.sellerId }, select: { phone_number: true, name: true } }),
    prisma.disputes.findFirst({ where: { bookingId: booking.id }, orderBy: { createdAt: "desc" } }),
    prisma.cancellations.findFirst({ where: { bookingId: booking.id }, orderBy: { createdAt: "desc" } }),
    prisma.reviews.findUnique({ where: { bookingId: booking.id } }),
  ]);
  const service = await prisma.services.findUnique({ where: { id: booking.serviceId }, select: { slug: true, optionGroups: true } });
  const isEventDay = kigaliToday() === booking.eventDate;
  const alternatives =
    booking.status === "cancelled_by_provider" && booking.resolution === "awaiting_choice"
      ? await findAlternatives(booking)
      : [];
  const altShops = alternatives.length
    ? await prisma.shops.findMany({ where: { id: { in: alternatives.map((a) => a.shopId) } }, select: { id: true, name: true, ratings: true, avatar: true } })
    : [];
  const altShopById = new Map(altShops.map((s) => [s.id, s]));

  res.json({
    booking,
    serviceSlug: service?.slug,
    shop: shop && { id: shop.id, name: shop.name, avatar: shop.avatar, district: shop.district, ratings: shop.ratings, sellerId: shop.sellerId },
    // Contact opens on the wedding day only (5)
    providerContact: isEventDay && ["confirmed", "completed"].includes(booking.status) ? { name: seller?.name, phone: seller?.phone_number } : null,
    chatOpen: isEventDay && ["confirmed", "completed"].includes(booking.status),
    cancellationQuote: booking.status === "confirmed" ? coupleCancellationQuote(booking) : null,
    cancellationTiers: COUPLE_CANCELLATION_TIERS,
    disputePresets: DISPUTE_PRESETS,
    dispute,
    cancellation: cancellation && { reasonCategory: cancellation.reasonCategory, reason: cancellation.initiatedBy === "provider" ? null : cancellation.reason, initiatedBy: cancellation.initiatedBy, refundAmount: cancellation.refundAmount, createdAt: cancellation.createdAt },
    review,
    alternatives: alternatives.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      basePrice: a.basePrice,
      images: a.images,
      ratings: a.ratings,
      reviewCount: a.reviewCount,
      optionGroups: a.optionGroups,
      priceDifference: a.priceDifference,
      shop: altShopById.get(a.shopId) || null,
    })),
    remaining: Math.max(0, booking.price + booking.bookingFee - (booking.amountPaid - booking.refundedAmount)),
  });
};

export const cancelQuote = async (req: any, res: Response) => {
  const booking = await loadOwn(req);
  if (booking.status !== "confirmed") throw new ValidationError("This booking cannot be cancelled");
  res.json({ quote: coupleCancellationQuote(booking) });
};

export const cancelBooking = async (req: any, res: Response) => {
  const booking = await loadOwn(req);
  const result = await cancelByCouple(booking.id, String(req.body.reason || "Cancelled by the couple").slice(0, 500));
  res.json({ success: true, ...result });
};

export const reschedule = async (req: any, res: Response) => {
  const booking = await loadOwn(req);
  const { eventDate, startTime } = req.body;
  if (!isValidDateString(eventDate)) throw new ValidationError("Choose a valid new date");
  if (startTime && !isValidTime(startTime)) throw new ValidationError("Choose a valid start time");
  const updated = await rescheduleBooking(booking.id, eventDate, startTime);
  res.json({ booking: updated });
};

export const refundChoice = async (req: any, res: Response) => {
  const booking = await loadOwn(req);
  const refunded = await chooseRefund(booking.id);
  res.json({ success: true, refunded });
};

export const replacementChoice = async (req: any, res: Response) => {
  const booking = await loadOwn(req);
  const { serviceId, selections, startTime } = req.body;
  if (!serviceId) throw new ValidationError("Choose a replacement service");
  if (startTime && !isValidTime(startTime)) throw new ValidationError("Choose a valid start time");
  const replacement = await chooseReplacement(booking.id, { serviceId, selections, startTime });
  res.json({ booking: replacement });
};

export const confirm = async (req: any, res: Response) => {
  const booking = await loadOwn(req);
  await confirmDelivery(booking.id);
  res.json({ success: true });
};

export const dispute = async (req: any, res: Response) => {
  const booking = await loadOwn(req);
  const evidence = await uploadEvidence(req.body.evidence, "disputes");
  const created = await openDispute(booking.id, req.user.id, {
    problemType: req.body.problemType,
    description: String(req.body.description || ""),
    evidence,
  });
  res.status(201).json({ dispute: created });
};

// 7-A: only couples with a completed booking can review
export const review = async (req: any, res: Response) => {
  const booking = await loadOwn(req);
  if (booking.status !== "released" || !booking.completedAt) {
    throw new ValidationError("You can review a service once it has been delivered");
  }
  if (booking.reviewed) throw new ValidationError("You already reviewed this booking");
  const rating = Math.round(Number(req.body.rating));
  if (!(rating >= 1 && rating <= 5)) throw new ValidationError("Rating must be between 1 and 5");
  const comment = req.body.comment ? String(req.body.comment).trim().slice(0, 1000) : null;

  const created = await prisma.reviews.create({
    data: {
      bookingId: booking.id,
      serviceId: booking.serviceId,
      sellerId: booking.sellerId,
      userId: req.user.id,
      userName: req.user.name.split(" ")[0],
      rating,
      comment,
    },
  });
  await prisma.bookings.update({ where: { id: booking.id }, data: { reviewed: true } });

  // Refresh averages on the service and the provider's profile
  const [svc, shop] = await Promise.all([
    prisma.reviews.aggregate({ where: { serviceId: booking.serviceId }, _avg: { rating: true }, _count: true }),
    prisma.reviews.aggregate({ where: { sellerId: booking.sellerId }, _avg: { rating: true }, _count: true }),
  ]);
  await prisma.services.update({ where: { id: booking.serviceId }, data: { ratings: svc._avg.rating || 0, reviewCount: svc._count } }).catch(() => null);
  await prisma.shops.update({ where: { id: booking.shopId }, data: { ratings: shop._avg.rating || 0, reviewCount: shop._count } });
  await recomputeVisibility(booking.sellerId);
  res.status(201).json({ review: created });
};
