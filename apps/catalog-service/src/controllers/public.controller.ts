import { Response } from "express";
import prisma from "@packages/libs/prisma";
import { NotFoundError, ValidationError } from "@packages/error-handler";
import { checkAvailability, unavailableDates } from "@packages/domain/availability";
import { DEFAULT_CATEGORIES, RWANDA_DISTRICTS, getSettings } from "@packages/utils/config";
import { calculatePrice } from "@packages/utils/pricing";
import { isValidDateString } from "@packages/utils/dates";
import { checkForContactDetails } from "@packages/utils/contactFilter";
import { notify } from "@packages/libs/notify";
import { pageParams, toInt } from "@packages/utils/server";

// Only providers who are verified and not suspended/banned are shown to couples
export const visibleSellerIds = async (): Promise<string[]> => {
  const sellers = await prisma.sellers.findMany({
    where: { verificationStatus: "approved", status: { in: ["active", "restricted"] } },
    select: { id: true },
  });
  return sellers.map((s) => s.id);
};

const publicShop = (shop: any) =>
  shop && {
    id: shop.id,
    name: shop.name,
    bio: shop.bio,
    category: shop.category,
    district: shop.district,
    address: shop.address,
    openHours: shop.openHours,
    website: shop.website,
    socialLinks: shop.socialLinks,
    avatar: shop.avatar,
    coverBanner: shop.coverBanner,
    ratings: shop.ratings,
    reviewCount: shop.reviewCount,
    sellerId: shop.sellerId,
    createdAt: shop.createdAt,
  };

export const listCategories = async (_req: any, res: Response) => {
  let categories = await prisma.categories.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  if (categories.length === 0) {
    await prisma.categories.createMany({ data: DEFAULT_CATEGORIES.map((c, i) => ({ ...c, order: i })) });
    categories = await prisma.categories.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  }
  res.json({ categories, districts: RWANDA_DISTRICTS });
};

export const publicSettings = async (_req: any, res: Response) => {
  const s = await getSettings();
  res.json({
    settings: {
      bookingFee: s.bookingFee,
      depositPercent: s.depositPercent,
      balanceDueDays: s.balanceDueDays,
      disputeWindowHours: s.disputeWindowHours,
      locationRevealDays: s.locationRevealDays,
      heroTitle: s.heroTitle,
      heroSubtitle: s.heroSubtitle,
      heroImage: s.heroImage,
    },
  });
};

const cardSelect = {
  id: true,
  title: true,
  slug: true,
  category: true,
  shortDescription: true,
  images: true,
  basePrice: true,
  priceUnit: true,
  serviceArea: true,
  ratings: true,
  reviewCount: true,
  bookingsCount: true,
  sellerId: true,
  shopId: true,
  createdAt: true,
  rankScore: true,
} as const;

const attachShops = async <T extends { shopId: string }>(services: T[]) => {
  const shops = await prisma.shops.findMany({
    where: { id: { in: [...new Set(services.map((s) => s.shopId))] } },
    select: { id: true, name: true, district: true, avatar: true, ratings: true },
  });
  const byId = new Map(shops.map((s) => [s.id, s]));
  return services.map((s) => ({ ...s, shop: byId.get(s.shopId) || null }));
};

/**
 * GET /services — browse & search.
 * Filters: q, category, district, minPrice, maxPrice, date (only providers free that day)
 * Sort: recommended (visibility score) | price_asc | price_desc | rating | newest
 */
export const listServices = async (req: any, res: Response) => {
  const { q, category, district, date, sort = "recommended" } = req.query;
  const { page, limit, skip } = pageParams(req.query, 12);
  const sellerIds = await visibleSellerIds();

  const where: any = { status: "published", isDeleted: false, sellerId: { in: sellerIds } };
  if (category) where.category = String(category);
  if (district) {
    where.OR = [{ serviceArea: { has: String(district) } }, { travelFee: { gt: 0 } }];
  }
  const minPrice = toInt(req.query.minPrice, 0);
  const maxPrice = toInt(req.query.maxPrice, 0);
  if (minPrice || maxPrice) {
    where.basePrice = {};
    if (minPrice) where.basePrice.gte = minPrice;
    if (maxPrice) where.basePrice.lte = maxPrice;
  }
  if (q && String(q).trim()) {
    const term = String(q).trim();
    where.AND = [
      {
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { shortDescription: { contains: term, mode: "insensitive" } },
          { tags: { has: term.toLowerCase() } },
          { category: { contains: term, mode: "insensitive" } },
        ],
      },
    ];
  }

  const orderBy: any =
    sort === "price_asc"
      ? { basePrice: "asc" }
      : sort === "price_desc"
      ? { basePrice: "desc" }
      : sort === "rating"
      ? [{ ratings: "desc" }, { reviewCount: "desc" }]
      : sort === "newest"
      ? { createdAt: "desc" }
      : [{ rankScore: "desc" }, { ratings: "desc" }];

  if (date && isValidDateString(date)) {
    // Availability filter: check each provider once, then paginate in memory
    const all = await prisma.services.findMany({ where, orderBy, select: cardSelect, take: 500 });
    const cache = new Map<string, boolean>();
    const available: typeof all = [];
    for (const s of all) {
      if (!cache.has(s.sellerId)) cache.set(s.sellerId, (await checkAvailability(s.sellerId, String(date))).available);
      if (cache.get(s.sellerId)) available.push(s);
    }
    const pageItems = available.slice(skip, skip + limit);
    return res.json({ services: await attachShops(pageItems), total: available.length, page, pages: Math.ceil(available.length / limit) });
  }

  const [items, total] = await Promise.all([
    prisma.services.findMany({ where, orderBy, select: cardSelect, skip, take: limit }),
    prisma.services.count({ where }),
  ]);
  res.json({ services: await attachShops(items), total, page, pages: Math.ceil(total / limit) });
};

export const getService = async (req: any, res: Response) => {
  const service = await prisma.services.findFirst({
    where: { OR: [{ slug: req.params.slug }, ...(req.params.slug.length === 24 ? [{ id: req.params.slug }] : [])], isDeleted: false },
  });
  if (!service) throw new NotFoundError("Service not found");
  const seller = await prisma.sellers.findUnique({ where: { id: service.sellerId } });
  const isOwner = req.seller?.id === service.sellerId;
  const visible =
    service.status === "published" &&
    seller?.verificationStatus === "approved" &&
    ["active", "restricted"].includes(seller?.status || "");
  if (!visible && !isOwner) throw new NotFoundError("This service is not available");

  const shop = await prisma.shops.findUnique({ where: { id: service.shopId } });
  await prisma.services.update({ where: { id: service.id }, data: { views: { increment: 1 } } });
  if (req.user) {
    await prisma.userEvents.create({
      data: { userId: req.user.id, action: "view", serviceId: service.id, sellerId: service.sellerId, category: service.category },
    });
  }
  const related = await prisma.services.findMany({
    where: { category: service.category, status: "published", isDeleted: false, id: { not: service.id }, sellerId: { in: await visibleSellerIds() } },
    orderBy: { rankScore: "desc" },
    select: cardSelect,
    take: 4,
  });
  res.json({
    service,
    shop: publicShop(shop),
    provider: seller && {
      id: seller.id,
      completedCount: seller.completedCount,
      memberSince: seller.createdAt,
      verified: seller.verificationStatus === "approved",
      accountType: seller.accountType,
    },
    related: await attachShops(related),
  });
};

// GET /services/:id/availability?date=YYYY-MM-DD
export const serviceAvailability = async (req: any, res: Response) => {
  const service = await prisma.services.findUnique({ where: { id: req.params.id } });
  if (!service) throw new NotFoundError("Service not found");
  const { date, month } = req.query;
  if (month && /^\d{4}-\d{2}$/.test(String(month))) {
    return res.json({ unavailable: await unavailableDates(service.sellerId, String(month)) });
  }
  if (!isValidDateString(date)) throw new ValidationError("Choose a valid date");
  if (req.user) {
    await prisma.userEvents.create({ data: { userId: req.user.id, action: "check_date", serviceId: service.id, category: service.category } });
  }
  res.json(await checkAvailability(service.sellerId, String(date)));
};

// POST /services/:id/quote  { selections, eventDistrict }
export const quoteService = async (req: any, res: Response) => {
  const service = await prisma.services.findUnique({ where: { id: req.params.id } });
  if (!service) throw new NotFoundError("Service not found");
  const { selections = [], eventDistrict } = req.body;
  if (eventDistrict && service.serviceArea.length && !service.serviceArea.includes(eventDistrict) && service.travelFee === 0) {
    throw new ValidationError("This provider does not travel to that district");
  }
  const settings = await getSettings();
  const priced = calculatePrice(service, selections, eventDistrict, service.serviceArea);
  res.json({ ...priced, bookingFee: settings.bookingFee, depositPercent: settings.depositPercent });
};

export const listQuestions = async (req: any, res: Response) => {
  const questions = await prisma.questions.findMany({
    where: { serviceId: req.params.id, isHidden: false },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ questions });
};

// POST /services/:id/questions (couples) — contact details are blocked
export const askQuestion = async (req: any, res: Response) => {
  const text = String(req.body.question || "").trim();
  if (text.length < 5 || text.length > 500) throw new ValidationError("Questions must be 5–500 characters");
  const check = checkForContactDetails(text);
  if (check.blocked) {
    throw new ValidationError(
      `Please don't share or ask for contact details (${check.reasons.join(", ")}). Bookings made outside HUZA have no payment protection, no refunds and no replacement if the provider cancels.`
    );
  }
  const service = await prisma.services.findUnique({ where: { id: req.params.id } });
  if (!service || service.status !== "published") throw new NotFoundError("Service not found");
  const recent = await prisma.questions.count({
    where: { userId: req.user.id, createdAt: { gt: new Date(Date.now() - 3600 * 1000) } },
  });
  if (recent >= 10) throw new ValidationError("You've asked a lot of questions in the last hour — please wait a bit.");
  const question = await prisma.questions.create({
    data: { serviceId: service.id, sellerId: service.sellerId, userId: req.user.id, userName: req.user.name.split(" ")[0], question: text },
  });
  await notify({
    recipientId: service.sellerId,
    recipientType: "seller",
    title: "New question on your listing",
    message: `A couple asked about "${service.title}": ${text}`,
    link: "/questions",
    type: "question",
  });
  res.status(201).json({ question });
};

export const listServiceReviews = async (req: any, res: Response) => {
  const reviews = await prisma.reviews.findMany({
    where: { serviceId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, userName: true, rating: true, comment: true, createdAt: true },
  });
  res.json({ reviews });
};

// GET /providers/:sellerId — public provider profile
export const getProvider = async (req: any, res: Response) => {
  const shop = await prisma.shops.findFirst({ where: { OR: [{ sellerId: req.params.id }, { id: req.params.id }] } });
  if (!shop) throw new NotFoundError("Provider not found");
  const seller = await prisma.sellers.findUnique({ where: { id: shop.sellerId } });
  if (!seller || seller.verificationStatus !== "approved" || !["active", "restricted"].includes(seller.status)) {
    throw new NotFoundError("Provider not available");
  }
  const [services, reviews] = await Promise.all([
    prisma.services.findMany({ where: { sellerId: seller.id, status: "published", isDeleted: false }, select: cardSelect, orderBy: { createdAt: "desc" } }),
    prisma.reviews.findMany({ where: { sellerId: seller.id }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, userName: true, rating: true, comment: true, createdAt: true, serviceId: true } }),
  ]);
  res.json({
    shop: publicShop(shop),
    provider: { id: seller.id, completedCount: seller.completedCount, memberSince: seller.createdAt, verified: true, accountType: seller.accountType },
    services: await attachShops(services),
    reviews,
  });
};

// GET /providers — top providers (ranked)
export const listProviders = async (req: any, res: Response) => {
  const { category, district } = req.query;
  const { limit, skip, page } = pageParams(req.query, 12);
  const sellers = await prisma.sellers.findMany({
    where: { verificationStatus: "approved", status: { in: ["active", "restricted"] } },
    orderBy: { visibilityScore: "desc" },
    select: { id: true, completedCount: true, visibilityScore: true },
  });
  const order = new Map(sellers.map((s, i) => [s.id, i]));
  const where: any = { sellerId: { in: sellers.map((s) => s.id) } };
  if (category) where.category = String(category);
  if (district) where.district = String(district);
  const shops = await prisma.shops.findMany({ where });
  shops.sort((a, b) => (order.get(a.sellerId) ?? 0) - (order.get(b.sellerId) ?? 0));
  const byId = new Map(sellers.map((s) => [s.id, s]));
  res.json({
    providers: shops.slice(skip, skip + limit).map((s) => ({ ...publicShop(s), completedCount: byId.get(s.sellerId)?.completedCount || 0 })),
    total: shops.length,
    page,
    pages: Math.ceil(shops.length / limit),
  });
};

// POST /events — lightweight interest tracking for recommendations
const TRACKED = ["view", "save", "unsave", "add_to_basket", "check_date"];
export const trackEvent = async (req: any, res: Response) => {
  const { action, serviceId } = req.body;
  if (!req.user || !TRACKED.includes(action)) return res.json({ ok: true });
  const service = serviceId ? await prisma.services.findUnique({ where: { id: serviceId } }) : null;
  await prisma.userEvents.create({
    data: { userId: req.user.id, action, serviceId: service?.id, sellerId: service?.sellerId, category: service?.category },
  });
  if (service && (action === "save" || action === "unsave")) {
    await prisma.services.update({ where: { id: service.id }, data: { saves: { increment: action === "save" ? 1 : -1 } } });
  }
  res.json({ ok: true });
};
