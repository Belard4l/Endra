import { Response } from "express";
import prisma from "@packages/libs/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@packages/error-handler";
import { deleteFile, uploadFile } from "@packages/libs/imagekit";
import { addStrike } from "@packages/domain/reliability";
import { CONTACT_VIOLATIONS_PER_STRIKE, RWANDA_DISTRICTS } from "@packages/utils/config";
import { checkForContactDetails } from "@packages/utils/contactFilter";
import { isValidDateString, kigaliToday } from "@packages/utils/dates";
import { randomId, uniqueSlug } from "@packages/utils/slug";
import { notify } from "@packages/libs/notify";

const MAX_IMAGES = 8;

const words = (t: string) => String(t || "").trim().split(/\s+/).filter(Boolean).length;
const cleanList = (v: unknown, max = 30) =>
  (Array.isArray(v) ? v : [])
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, max);

/** Records a contact-sharing attempt; every 3 attempts become a strike */
const recordContactViolation = async (sellerId: string) => {
  const seller = await prisma.sellers.update({ where: { id: sellerId }, data: { contactViolations: { increment: 1 } } });
  if (seller.contactViolations % CONTACT_VIOLATIONS_PER_STRIKE === 0) {
    await addStrike(sellerId, "Repeated attempts to share contact details before the wedding day");
  } else {
    await notify({
      recipientId: sellerId,
      recipientType: "seller",
      title: "Contact details are not allowed",
      message: `Sharing phone numbers, emails, links or social handles before the wedding day is not allowed. ${CONTACT_VIOLATIONS_PER_STRIKE - (seller.contactViolations % CONTACT_VIOLATIONS_PER_STRIKE)} more attempt(s) will add a strike.`,
      type: "account",
    });
  }
};

/** Rejects listing text that contains contact details */
const assertNoContacts = async (sellerId: string, fields: Record<string, string | undefined | null>) => {
  for (const [name, value] of Object.entries(fields)) {
    if (!value) continue;
    const check = checkForContactDetails(value);
    if (check.blocked) {
      await recordContactViolation(sellerId);
      throw new ValidationError(`"${name}" contains ${check.reasons.join(", ")}. Contact details can't be shared on HUZA before the wedding day.`);
    }
  }
};

const normaliseOptionGroups = (groups: unknown) => {
  if (!Array.isArray(groups)) return [];
  return groups.slice(0, 10).map((g: any) => {
    const name = String(g?.name || "").trim();
    if (!name) throw new ValidationError("Every option group needs a name");
    const choices = (Array.isArray(g.choices) ? g.choices : []).slice(0, 15).map((c: any) => {
      const label = String(c?.label || "").trim();
      if (!label) throw new ValidationError(`Every choice in "${name}" needs a label`);
      const priceDelta = Math.round(Number(c.priceDelta) || 0);
      return { id: c.id || randomId(4), label, priceDelta };
    });
    if (choices.length === 0) throw new ValidationError(`"${name}" needs at least one choice`);
    return { id: g.id || randomId(4), name, type: g.type === "multiple" ? "multiple" : "single", required: Boolean(g.required), choices };
  });
};

const processImages = async (images: unknown, existing: { fileId: string; url: string }[] = []) => {
  const list = Array.isArray(images) ? images.slice(0, MAX_IMAGES) : [];
  const result: { fileId: string; url: string }[] = [];
  for (const img of list) {
    if (typeof img === "string" && img.startsWith("data:")) {
      const f = await uploadFile(img, "service", "services");
      result.push({ fileId: f.fileId, url: f.url });
    } else if (img && typeof img === "object" && (img as any).fileId) {
      const keep = existing.find((e) => e.fileId === (img as any).fileId);
      if (keep) result.push(keep);
    }
  }
  // Delete images that were removed
  for (const old of existing) {
    if (!result.some((r) => r.fileId === old.fileId)) await deleteFile(old.fileId);
  }
  return result;
};

const buildServiceData = async (body: any, sellerId: string) => {
  const title = String(body.title || "").trim();
  const shortDescription = String(body.shortDescription || "").trim();
  const description = String(body.description || "").trim();
  const requirements = String(body.requirements || "").trim();
  const basePrice = Math.round(Number(body.basePrice));
  const serviceArea = cleanList(body.serviceArea).filter((d) => RWANDA_DISTRICTS.includes(d));
  const included = cleanList(body.included);
  const excluded = cleanList(body.excluded);

  // Required listing template (5): answer the usual questions up front
  if (title.length < 5) throw new ValidationError("Title must be at least 5 characters");
  if (!shortDescription || words(shortDescription) > 40) throw new ValidationError("Short description is required (max 40 words)");
  if (words(description) < 50) throw new ValidationError("Detailed description must be at least 50 words");
  if (!Number.isFinite(basePrice) || basePrice < 1000) throw new ValidationError("Base price must be at least 1,000 RWF");
  if (serviceArea.length === 0) throw new ValidationError("Choose at least one district you serve");
  if (included.length === 0) throw new ValidationError("List what is included");
  if (!requirements) throw new ValidationError("Describe your requirements (setup time, power, space…)");
  const category = String(body.category || "");
  if (!(await prisma.categories.findUnique({ where: { slug: category } }))) throw new ValidationError("Choose a valid category");

  await assertNoContacts(sellerId, {
    Title: title,
    "Short description": shortDescription,
    Description: description,
    Requirements: requirements,
    "Cultural options": body.culturalOptions,
    "Extra terms": body.extraTerms,
    Included: included.join(" "),
    Excluded: excluded.join(" "),
  });

  return {
    title,
    category,
    shortDescription,
    description,
    basePrice,
    priceUnit: String(body.priceUnit || "per event").slice(0, 30),
    optionGroups: normaliseOptionGroups(body.optionGroups),
    durationHours: body.durationHours ? Math.max(1, Math.round(Number(body.durationHours))) : null,
    serviceArea,
    travelFee: Math.max(0, Math.round(Number(body.travelFee) || 0)),
    included,
    excluded,
    requirements,
    culturalOptions: body.culturalOptions ? String(body.culturalOptions).trim() : null,
    extraTerms: body.extraTerms ? String(body.extraTerms).trim() : null,
    tags: cleanList(body.tags, 10).map((t) => t.toLowerCase()),
  };
};

/** A listing can only go live once the provider is verified and can be paid */
const assertCanPublish = (seller: any) => {
  if (seller.verificationStatus !== "approved") throw new ForbiddenError("Your account must be verified before listings can be published");
  if (!seller.paymentMethod) throw new ForbiddenError("Add a MoMo or bank payout method before publishing");
  if (["suspended", "banned"].includes(seller.status)) throw new ForbiddenError(`Your account is ${seller.status}`);
};

export const myServices = async (req: any, res: Response) => {
  const services = await prisma.services.findMany({ where: { sellerId: req.seller.id }, orderBy: { createdAt: "desc" } });
  res.json({ services });
};

export const myService = async (req: any, res: Response) => {
  const service = await prisma.services.findFirst({ where: { id: req.params.id, sellerId: req.seller.id } });
  if (!service) throw new NotFoundError("Service not found");
  res.json({ service });
};

export const createService = async (req: any, res: Response) => {
  const shop = req.seller.shop;
  if (!shop) throw new ValidationError("Create your business profile first");
  const data = await buildServiceData(req.body, req.seller.id);
  const images = await processImages(req.body.images);
  const publish = req.body.status === "published";
  if (publish) {
    assertCanPublish(req.seller);
    if (images.length === 0) throw new ValidationError("Add at least one photo before publishing");
  }
  const service = await prisma.services.create({
    data: {
      ...data,
      images,
      slug: uniqueSlug(data.title),
      sellerId: req.seller.id,
      shopId: shop.id,
      status: publish ? "published" : "draft",
      rankScore: req.seller.visibilityScore || 0,
    },
  });
  res.status(201).json({ service });
};

export const updateService = async (req: any, res: Response) => {
  const existing = await prisma.services.findFirst({ where: { id: req.params.id, sellerId: req.seller.id, isDeleted: false } });
  if (!existing) throw new NotFoundError("Service not found");
  const data = await buildServiceData(req.body, req.seller.id);
  const images = await processImages(req.body.images, existing.images);
  const status = ["draft", "published", "hidden"].includes(req.body.status) ? req.body.status : existing.status;
  if (status === "published") {
    assertCanPublish(req.seller);
    if (images.length === 0) throw new ValidationError("Add at least one photo before publishing");
  }
  const service = await prisma.services.update({ where: { id: existing.id }, data: { ...data, images, status } });
  res.json({ service });
};

export const setServiceStatus = async (req: any, res: Response) => {
  const existing = await prisma.services.findFirst({ where: { id: req.params.id, sellerId: req.seller.id, isDeleted: false } });
  if (!existing) throw new NotFoundError("Service not found");
  const status = req.body.status;
  if (!["draft", "published", "hidden"].includes(status)) throw new ValidationError("Invalid status");
  if (status === "published") {
    assertCanPublish(req.seller);
    if (existing.images.length === 0) throw new ValidationError("Add at least one photo before publishing");
  }
  const service = await prisma.services.update({ where: { id: existing.id }, data: { status } });
  res.json({ service });
};

// Soft delete with a 24-hour restore window (a cron removes it for good)
export const deleteService = async (req: any, res: Response) => {
  const existing = await prisma.services.findFirst({ where: { id: req.params.id, sellerId: req.seller.id } });
  if (!existing) throw new NotFoundError("Service not found");
  const upcoming = await prisma.bookings.count({
    where: { serviceId: existing.id, status: { in: ["pending_payment", "confirmed"] }, eventDate: { gte: kigaliToday() } },
  });
  if (upcoming > 0) throw new ValidationError("This service has upcoming bookings. Hide it instead of deleting it.");
  await prisma.services.update({ where: { id: existing.id }, data: { isDeleted: true, deletedAt: new Date(), status: "hidden" } });
  res.json({ success: true, message: "Service deleted. You can restore it within 24 hours." });
};

export const restoreService = async (req: any, res: Response) => {
  const existing = await prisma.services.findFirst({ where: { id: req.params.id, sellerId: req.seller.id, isDeleted: true } });
  if (!existing) throw new NotFoundError("Service not found");
  if (existing.deletedAt && Date.now() - existing.deletedAt.getTime() > 24 * 3600 * 1000) {
    throw new ValidationError("The 24-hour restore window has passed");
  }
  const service = await prisma.services.update({ where: { id: existing.id }, data: { isDeleted: false, deletedAt: null, status: "draft" } });
  res.json({ service });
};

// ───── Availability (capacity per day + blocked dates) ─────

export const getAvailability = async (req: any, res: Response) => {
  const shop = await prisma.shops.findUnique({ where: { sellerId: req.seller.id } });
  if (!shop) throw new ValidationError("Create your business profile first");
  const today = kigaliToday();
  const bookings = await prisma.bookings.findMany({
    where: { sellerId: req.seller.id, eventDate: { gte: today }, status: { in: ["confirmed", "completed", "disputed", "pending_payment"] } },
    select: { eventDate: true, status: true, serviceTitle: true, startTime: true },
    orderBy: { eventDate: "asc" },
  });
  res.json({
    capacityPerDay: shop.capacityPerDay,
    blockedDates: shop.blockedDates.filter((d) => d >= today).sort(),
    bookings: bookings.filter((b) => b.status !== "pending_payment"),
  });
};

export const updateAvailability = async (req: any, res: Response) => {
  const shop = await prisma.shops.findUnique({ where: { sellerId: req.seller.id } });
  if (!shop) throw new ValidationError("Create your business profile first");
  const { capacityPerDay, blockedDates } = req.body;
  const data: Record<string, any> = {};
  if (capacityPerDay !== undefined) {
    const cap = Math.round(Number(capacityPerDay));
    if (!Number.isFinite(cap) || cap < 1 || cap > 20) throw new ValidationError("Events per day must be between 1 and 20");
    data.capacityPerDay = cap;
  }
  if (Array.isArray(blockedDates)) {
    const clean = [...new Set(blockedDates.filter((d) => isValidDateString(d)))] as string[];
    const booked = await prisma.bookings.findMany({
      where: { sellerId: req.seller.id, eventDate: { in: clean }, status: { in: ["confirmed", "completed"] } },
      select: { eventDate: true },
    });
    if (booked.length) {
      throw new ValidationError(
        `You have bookings on ${[...new Set(booked.map((b) => b.eventDate))].join(", ")}. Blocking a date doesn't cancel bookings — cancel them from the booking page if you really can't attend.`
      );
    }
    data.blockedDates = clean.sort();
  }
  const updated = await prisma.shops.update({ where: { id: shop.id }, data });
  res.json({ capacityPerDay: updated.capacityPerDay, blockedDates: updated.blockedDates });
};

// ───── Public Q&A ─────

export const myQuestions = async (req: any, res: Response) => {
  const filter = req.query.status;
  const where: any = { sellerId: req.seller.id, isHidden: false };
  if (filter === "unanswered") where.answer = { isSet: false };
  const questions = await prisma.questions.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  const services = await prisma.services.findMany({ where: { id: { in: questions.map((q) => q.serviceId) } }, select: { id: true, title: true, slug: true } });
  const byId = new Map(services.map((s) => [s.id, s]));
  res.json({ questions: questions.map((q) => ({ ...q, service: byId.get(q.serviceId) || null })) });
};

export const answerQuestion = async (req: any, res: Response) => {
  const q = await prisma.questions.findFirst({ where: { id: req.params.id, sellerId: req.seller.id } });
  if (!q) throw new NotFoundError("Question not found");
  const answer = String(req.body.answer || "").trim();
  if (answer.length < 2 || answer.length > 1000) throw new ValidationError("Answers must be 2–1000 characters");
  await assertNoContacts(req.seller.id, { Answer: answer });
  const updated = await prisma.questions.update({ where: { id: q.id }, data: { answer, answeredAt: new Date() } });
  const service = await prisma.services.findUnique({ where: { id: q.serviceId }, select: { slug: true, title: true } });
  await notify({
    recipientId: q.userId,
    recipientType: "user",
    title: "Your question was answered",
    message: `${service?.title}: ${answer}`,
    link: service ? `/services/${service.slug}#questions` : undefined,
    type: "question",
  });
  res.json({ question: updated });
};

export const myReviews = async (req: any, res: Response) => {
  const reviews = await prisma.reviews.findMany({ where: { sellerId: req.seller.id }, orderBy: { createdAt: "desc" } });
  res.json({ reviews });
};
