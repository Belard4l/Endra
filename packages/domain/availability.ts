/**
 * Provider availability. A provider sets how many events they can take per day
 * (capacityPerDay) and blocks dates they are unavailable. Bookings that are
 * paid, in progress, or held at checkout count against capacity.
 */
import prisma from "@packages/libs/prisma";
import { ALTERNATIVE_PRICE_WINDOW } from "@packages/utils/config";
import { daysUntil } from "@packages/utils/dates";

export const ACTIVE_BOOKING_STATUSES = ["confirmed", "completed", "disputed", "released"];

export type SlotCheck = { available: boolean; reason?: string; remaining?: number };

export const checkAvailability = async (
  sellerId: string,
  eventDate: string,
  opts: { excludeBookingId?: string } = {}
): Promise<SlotCheck> => {
  if (daysUntil(eventDate) < 1) {
    return { available: false, reason: "Bookings must be made at least one day before the event." };
  }
  const seller = await prisma.sellers.findUnique({ where: { id: sellerId }, include: { shop: true } });
  if (!seller || !seller.shop) return { available: false, reason: "Provider not found." };
  if (seller.status === "suspended" || seller.status === "banned") {
    return { available: false, reason: "This provider is not taking bookings." };
  }
  if (seller.verificationStatus !== "approved") {
    return { available: false, reason: "This provider has not been verified yet." };
  }
  if (seller.shop.blockedDates.includes(eventDate)) {
    return { available: false, reason: "The provider is unavailable on this date." };
  }

  const taken = await prisma.bookings.count({
    where: {
      sellerId,
      eventDate,
      ...(opts.excludeBookingId ? { id: { not: opts.excludeBookingId } } : {}),
      OR: [
        { status: { in: ACTIVE_BOOKING_STATUSES } },
        { status: "pending_payment", holdExpiresAt: { gt: new Date() } },
      ],
    },
  });
  const remaining = seller.shop.capacityPerDay - taken;
  if (remaining <= 0) return { available: false, reason: "The provider is fully booked on this date.", remaining: 0 };
  return { available: true, remaining };
};

/** Dates in a month the provider cannot take (blocked or full) — for calendars */
export const unavailableDates = async (sellerId: string, month: string): Promise<string[]> => {
  const shop = await prisma.shops.findUnique({ where: { sellerId } });
  if (!shop) return [];
  const bookings = await prisma.bookings.findMany({
    where: {
      sellerId,
      eventDate: { startsWith: month },
      OR: [
        { status: { in: ACTIVE_BOOKING_STATUSES } },
        { status: "pending_payment", holdExpiresAt: { gt: new Date() } },
      ],
    },
    select: { eventDate: true },
  });
  const counts: Record<string, number> = {};
  bookings.forEach((b) => (counts[b.eventDate] = (counts[b.eventDate] || 0) + 1));
  const full = Object.entries(counts)
    .filter(([, n]) => n >= shop.capacityPerDay)
    .map(([d]) => d);
  return [...new Set([...shop.blockedDates.filter((d) => d.startsWith(month)), ...full])].sort();
};

/**
 * Suggested replacements when a provider cancels: same category, free on the
 * same date, serving the area, price close to the original (±15%, widened if
 * too few), ranked by price closeness, rating and visibility.
 */
export const findAlternatives = async (
  booking: { sellerId: string; category: string; eventDate: string; eventDistrict: string; price: number },
  limit = 5
) => {
  const candidates = await prisma.services.findMany({
    where: {
      category: booking.category,
      status: "published",
      isDeleted: false,
      sellerId: { not: booking.sellerId },
    },
    orderBy: { rankScore: "desc" },
    take: 200,
  });

  const withinWindow = (window: number) =>
    candidates.filter((s) => {
      const low = booking.price * (1 - window);
      const high = booking.price * (1 + window);
      return s.basePrice >= low * 0.8 && s.basePrice <= high;
    });

  let pool = withinWindow(ALTERNATIVE_PRICE_WINDOW);
  if (pool.length < 3) pool = withinWindow(0.4);

  const results: (typeof candidates[number] & { priceDifference: number })[] = [];
  const checkedSellers = new Set<string>();
  for (const service of pool) {
    if (results.length >= limit) break;
    if (service.serviceArea.length && !service.serviceArea.includes(booking.eventDistrict) && service.travelFee === 0) {
      // does not travel to this district
      continue;
    }
    if (checkedSellers.has(service.sellerId)) continue;
    const slot = await checkAvailability(service.sellerId, booking.eventDate);
    checkedSellers.add(service.sellerId);
    if (!slot.available) continue;
    results.push({ ...service, priceDifference: service.basePrice - booking.price });
  }

  return results.sort(
    (a, b) =>
      Math.abs(a.priceDifference) - Math.abs(b.priceDifference) ||
      b.ratings - a.ratings ||
      b.rankScore - a.rankScore
  );
};
