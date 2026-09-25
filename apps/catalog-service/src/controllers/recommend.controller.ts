/**
 * Recommendations, built for couples who book once (not repeat shoppers):
 *  1. Booking context — wedding date, district, budget, and which categories
 *     are still missing from their plan.
 *  2. Similar services — same categories and price range as what they viewed,
 *     saved or added to their basket (weighted like the tutorial: book 1.0,
 *     basket 0.7, save 0.5, date check 0.3, view 0.1).
 *  3. "Couples who booked X also booked Y" once real bookings exist.
 */
import { Response } from "express";
import prisma from "@packages/libs/prisma";
import { checkAvailability } from "@packages/domain/availability";
import { isValidDateString } from "@packages/utils/dates";
import { toInt } from "@packages/utils/server";
import { visibleSellerIds } from "./public.controller";

const WEIGHTS: Record<string, number> = { book: 1, add_to_basket: 0.7, save: 0.5, check_date: 0.3, view: 0.1 };
const CORE_CATEGORIES = ["venue", "photography", "catering", "decoration", "music", "mc"];
const PAID_STATUSES = ["confirmed", "completed", "disputed", "released"];

export const recommendations = async (req: any, res: Response) => {
  const user = req.user;
  const date = isValidDateString(req.query.date) ? String(req.query.date) : user?.weddingDate || null;
  const district = (req.query.district as string) || user?.weddingDistrict || null;
  const budget = toInt(req.query.budget, 0) || user?.budget || 0;

  const sellerIds = await visibleSellerIds();

  // Categories already booked → recommend what's missing instead
  const booked = user
    ? await prisma.bookings.findMany({ where: { userId: user.id, status: { in: PAID_STATUSES } }, select: { category: true } })
    : [];
  const bookedCategories = new Set(booked.map((b) => b.category));

  // Interest profile
  const events = user
    ? await prisma.userEvents.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 })
    : [];
  const categoryInterest: Record<string, number> = {};
  const viewedServiceIds = new Set<string>();
  for (const e of events) {
    if (e.category) categoryInterest[e.category] = (categoryInterest[e.category] || 0) + (WEIGHTS[e.action] || 0);
    if (e.serviceId) viewedServiceIds.add(e.serviceId);
  }
  const viewed = viewedServiceIds.size
    ? await prisma.services.findMany({ where: { id: { in: [...viewedServiceIds] } }, select: { category: true, basePrice: true } })
    : [];
  const avgPriceByCategory: Record<string, number> = {};
  viewed.forEach((v) => {
    avgPriceByCategory[v.category] = avgPriceByCategory[v.category] ? (avgPriceByCategory[v.category] + v.basePrice) / 2 : v.basePrice;
  });

  const where: any = { status: "published", isDeleted: false, sellerId: { in: sellerIds } };
  if (bookedCategories.size) where.category = { notIn: [...bookedCategories] };
  if (district) where.OR = [{ serviceArea: { has: district } }, { travelFee: { gt: 0 } }, { serviceArea: { isEmpty: true } }];
  if (budget) where.basePrice = { lte: budget };

  const candidates = await prisma.services.findMany({ where, orderBy: { rankScore: "desc" }, take: 150 });

  const scored = candidates
    .map((s) => {
      const reasons: string[] = [];
      let score = s.rankScore * 0.3 + s.ratings;
      const interest = categoryInterest[s.category] || 0;
      if (interest > 0) {
        score += interest * 10;
        reasons.push("Based on what you've been exploring");
      }
      const avg = avgPriceByCategory[s.category];
      if (avg && Math.abs(s.basePrice - avg) <= avg * 0.3) {
        score += 5;
        reasons.push("Similar price to services you viewed");
      }
      if (user && !bookedCategories.has(s.category) && CORE_CATEGORIES.includes(s.category) && booked.length > 0) {
        score += 4;
        reasons.push("Still missing from your wedding plan");
      }
      if (district && s.serviceArea.includes(district)) {
        score += 2;
        reasons.push(`Serves ${district}`);
      }
      if (viewedServiceIds.has(s.id)) score -= 3; // prefer fresh suggestions
      return { service: s, score, reasons };
    })
    .sort((a, b) => b.score - a.score);

  const results: any[] = [];
  const checked = new Map<string, boolean>();
  for (const item of scored) {
    if (results.length >= 10) break;
    if (date) {
      if (!checked.has(item.service.sellerId)) {
        checked.set(item.service.sellerId, (await checkAvailability(item.service.sellerId, date)).available);
      }
      if (!checked.get(item.service.sellerId)) continue;
      item.reasons.unshift("Free on your wedding day");
    }
    results.push({ ...item.service, reasons: [...new Set(item.reasons)].slice(0, 2) });
  }

  // Fallback: newest services when we know nothing yet
  if (results.length === 0) {
    const latest = await prisma.services.findMany({
      where: { status: "published", isDeleted: false, sellerId: { in: sellerIds } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    results.push(...latest.map((s) => ({ ...s, reasons: ["New on HUZA"] })));
  }

  const shops = await prisma.shops.findMany({
    where: { id: { in: results.map((r) => r.shopId) } },
    select: { id: true, name: true, district: true, avatar: true, ratings: true },
  });
  const shopById = new Map(shops.map((s) => [s.id, s]));

  const allCategories = await prisma.categories.findMany({ orderBy: { order: "asc" } });
  res.json({
    recommendations: results.map((r) => ({ ...r, shop: shopById.get(r.shopId) || null })),
    context: { date, district, budget: budget || null },
    missingCategories: user && booked.length ? allCategories.filter((c) => !bookedCategories.has(c.slug)).map((c) => c.slug) : [],
    bookedCategories: [...bookedCategories],
  });
};

// GET /services/:id/also-booked
export const alsoBooked = async (req: any, res: Response) => {
  const service = await prisma.services.findUnique({ where: { id: req.params.id } });
  if (!service) return res.json({ services: [] });
  const couples = await prisma.bookings.findMany({
    where: { serviceId: service.id, status: { in: PAID_STATUSES } },
    select: { userId: true },
    take: 500,
  });
  const userIds = [...new Set(couples.map((c) => c.userId))];
  if (userIds.length === 0) return res.json({ services: [] });
  const others = await prisma.bookings.findMany({
    where: { userId: { in: userIds }, serviceId: { not: service.id }, category: { not: service.category }, status: { in: PAID_STATUSES } },
    select: { serviceId: true },
  });
  const counts: Record<string, number> = {};
  others.forEach((o) => (counts[o.serviceId] = (counts[o.serviceId] || 0) + 1));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
  const sellerIds = await visibleSellerIds();
  const services = await prisma.services.findMany({
    where: { id: { in: top }, status: "published", isDeleted: false, sellerId: { in: sellerIds } },
  });
  const shops = await prisma.shops.findMany({ where: { id: { in: services.map((s) => s.shopId) } }, select: { id: true, name: true, district: true, avatar: true, ratings: true } });
  const shopById = new Map(shops.map((s) => [s.id, s]));
  res.json({
    services: services
      .sort((a, b) => top.indexOf(a.id) - top.indexOf(b.id))
      .map((s) => ({ ...s, shop: shopById.get(s.shopId) || null, bookedTogether: counts[s.id] })),
  });
};
