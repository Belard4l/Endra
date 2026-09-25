/**
 * Provider reliability: strikes, account status and visibility ranking.
 */
import prisma from "@packages/libs/prisma";
import { notify, notifyAdmins } from "@packages/libs/notify";
import {
  NEW_PROVIDER_BOOST_BOOKINGS,
  NEW_PROVIDER_BOOST_DAYS,
  STRIKE_LEVELS,
  STRIKE_WINDOW_MONTHS,
} from "@packages/utils/config";
import { addMonths } from "@packages/utils/dates";

const DAY = 24 * 3600 * 1000;

/**
 * Ranking score used to order search results, category pages and suggested
 * alternatives. More completed weddings → more visibility, balanced by rating,
 * recent activity, reliability, and a temporary boost for new providers.
 */
export const recomputeVisibility = async (sellerId: string): Promise<number> => {
  const seller = await prisma.sellers.findUnique({ where: { id: sellerId }, include: { shop: true } });
  if (!seller) return 0;

  const since = new Date(Date.now() - 90 * DAY);
  const recentCompleted = await prisma.bookings.count({
    where: { sellerId, status: "released", releasedAt: { gte: since }, completedAt: { not: null } },
  });

  const rating = seller.shop?.ratings ?? 0;
  const reviewCount = seller.shop?.reviewCount ?? 0;
  const ratingPart = reviewCount > 0 ? (rating - 3) * 4 * Math.min(1, reviewCount / 5) : 0;
  const deliveredPart = 10 * Math.log2(1 + seller.completedCount);
  const recencyPart = Math.min(10, recentCompleted * 2);
  const reliabilityPart = -8 * seller.activeStrikes;
  const isNew =
    Date.now() - seller.createdAt.getTime() < NEW_PROVIDER_BOOST_DAYS * DAY ||
    seller.completedCount < NEW_PROVIDER_BOOST_BOOKINGS;
  const newPart = isNew ? 12 : 0;

  let score = deliveredPart + ratingPart + recencyPart + reliabilityPart + newPart;
  if (seller.status === "restricted") score *= 0.5;
  if (seller.status === "suspended" || seller.status === "banned") score = -1000;
  score = Math.round(score * 100) / 100;

  await prisma.sellers.update({ where: { id: sellerId }, data: { visibilityScore: score } });
  await prisma.services.updateMany({ where: { sellerId }, data: { rankScore: score } });
  return score;
};

const STATUS_MESSAGES: Record<string, string> = {
  active: "Your account is in good standing.",
  restricted:
    "You now have 2 active strikes. Your listings appear lower in search results until a strike expires.",
  suspended:
    "You now have 3 or more active strikes. Your listings are hidden and you cannot take new bookings. Existing bookings must still be honoured.",
};

/** Recounts active strikes (rolling window) and updates the provider's status */
export const evaluateSellerStatus = async (sellerId: string) => {
  const seller = await prisma.sellers.findUnique({ where: { id: sellerId } });
  if (!seller) return;
  const active = await prisma.strikes.count({ where: { sellerId, expiresAt: { gt: new Date() } } });

  let status = "active";
  if (active >= STRIKE_LEVELS.suspended) status = "suspended";
  else if (active >= STRIKE_LEVELS.restricted) status = "restricted";
  const banRecommended = active >= STRIKE_LEVELS.banRecommended;

  // A ban is final and only an admin can lift it
  if (seller.status === "banned") status = "banned";

  await prisma.sellers.update({
    where: { id: sellerId },
    data: { activeStrikes: active, status, banRecommended },
  });

  if (status !== seller.status && STATUS_MESSAGES[status]) {
    await notify({
      recipientId: sellerId,
      recipientType: "seller",
      title: `Account status: ${status}`,
      message: STATUS_MESSAGES[status],
      link: "/penalties",
      type: "account",
      critical: status !== "active",
    });
  }
  if (banRecommended && !seller.banRecommended) {
    await notifyAdmins(
      "Ban recommended",
      `${seller.name} has ${active} active strikes. Review the account and confirm or reject a permanent ban.`,
      `/providers/${sellerId}`
    );
  }
  await recomputeVisibility(sellerId);
};

export const addStrike = async (sellerId: string, reason: string, penaltyId?: string) => {
  await prisma.strikes.create({
    data: { sellerId, reason, penaltyId, expiresAt: addMonths(new Date(), STRIKE_WINDOW_MONTHS) },
  });
  const count = await prisma.strikes.count({ where: { sellerId, expiresAt: { gt: new Date() } } });
  if (count === STRIKE_LEVELS.warning) {
    await notify({
      recipientId: sellerId,
      recipientType: "seller",
      title: "Warning: you received a strike",
      message: `Reason: ${reason}. Strikes last ${STRIKE_WINDOW_MONTHS} months. 2 strikes lower your placement, 3 suspend your account.`,
      link: "/penalties",
      type: "account",
      critical: true,
    });
  }
  await evaluateSellerStatus(sellerId);
};
