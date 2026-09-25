import { Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "@packages/libs/prisma";
import { NotFoundError, ValidationError } from "@packages/error-handler";
import { notify } from "@packages/libs/notify";
import { signedUrl, uploadFile, deleteFile } from "@packages/libs/imagekit";
import { resolveDispute } from "@packages/domain/bookings";
import { confirmPenalty, waivePenalty } from "@packages/domain/penalties";
import { retryPayout, runWeeklyPayouts } from "@packages/domain/payouts";
import { evaluateSellerStatus, recomputeVisibility } from "@packages/domain/reliability";
import { getSettings } from "@packages/utils/config";
import { kigaliWeekday } from "@packages/utils/dates";
import { pageParams } from "@packages/utils/server";
import { slugify } from "@packages/utils/slug";

const signFiles = (files: any[] = []) => files.map((f) => ({ name: f.name, url: signedUrl(f) }));

const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
};

// ───── Dashboard ─────

export const dashboard = async (_req: any, res: Response) => {
  const since = new Date(Date.now() - 180 * 24 * 3600 * 1000);
  const [users, providers, pendingVerification, activeBookings, openDisputes, appeals, failedPayouts, banRecommended, recent, released] =
    await Promise.all([
      prisma.users.count({ where: { role: "user" } }),
      prisma.sellers.count(),
      prisma.sellers.count({ where: { verificationStatus: "pending" } }),
      prisma.bookings.count({ where: { status: { in: ["confirmed", "completed", "disputed"] } } }),
      prisma.disputes.count({ where: { status: "open" } }),
      prisma.penalties.count({ where: { status: "appealed" } }),
      prisma.payouts.count({ where: { status: "failed" } }),
      prisma.sellers.count({ where: { banRecommended: true, status: { not: "banned" } } }),
      prisma.bookings.findMany({ where: { status: { notIn: ["pending_payment", "expired"] } }, orderBy: { createdAt: "desc" }, take: 8 }),
      prisma.bookings.findMany({ where: { releasedAt: { gte: since } }, select: { releasedAt: true, platformAmount: true, price: true } }),
    ]);
  const [gmv, commission, bookingFees, collectionFees] = await Promise.all([
    prisma.ledgerEntries.aggregate({ where: { type: "payment_received" }, _sum: { amount: true } }),
    prisma.ledgerEntries.aggregate({ where: { type: "platform_commission" }, _sum: { amount: true } }),
    prisma.ledgerEntries.aggregate({ where: { type: "booking_fee" }, _sum: { amount: true } }),
    prisma.ledgerEntries.aggregate({ where: { type: "collection_fee" }, _sum: { amount: true } }),
  ]);
  const monthly: Record<string, { commission: number; volume: number }> = {};
  released.forEach((b) => {
    const k = b.releasedAt!.toISOString().slice(0, 7);
    monthly[k] = monthly[k] || { commission: 0, volume: 0 };
    monthly[k].commission += b.platformAmount;
    monthly[k].volume += b.price;
  });
  const byCategory = await prisma.bookings.groupBy({
    by: ["category"],
    where: { status: { in: ["confirmed", "completed", "disputed", "released"] } },
    _count: true,
  });
  res.json({
    stats: {
      users,
      providers,
      pendingVerification,
      activeBookings,
      openDisputes,
      appeals,
      failedPayouts,
      banRecommended,
      paymentsReceived: gmv._sum.amount || 0,
      commission: commission._sum.amount || 0,
      bookingFees: bookingFees._sum.amount || 0,
      collectionFees: -(collectionFees._sum.amount || 0),
    },
    monthly: Object.entries(monthly).sort().map(([month, v]) => ({ month, ...v })),
    byCategory: byCategory.map((c) => ({ category: c.category, count: c._count })),
    recent,
  });
};

// ───── Providers ─────

export const listProviders = async (req: any, res: Response) => {
  const { q, status, verification } = req.query;
  const { skip, limit, page } = pageParams(req.query, 25);
  const where: any = {};
  if (status) where.status = String(status);
  if (verification) where.verificationStatus = String(verification);
  if (req.query.banRecommended === "true") where.banRecommended = true;
  if (q) where.OR = [{ name: { contains: String(q), mode: "insensitive" } }, { email: { contains: String(q), mode: "insensitive" } }];
  const [items, total] = await Promise.all([
    prisma.sellers.findMany({ where, include: { shop: true }, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.sellers.count({ where }),
  ]);
  res.json({
    providers: items.map(({ password, nationalIdNumber, nationalIdDoc, rdbCertificateDoc, ...s }) => s),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
};

export const exportProviders = async (_req: any, res: Response) => {
  const sellers = await prisma.sellers.findMany({ include: { shop: true }, orderBy: { createdAt: "desc" } });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=huza-providers.csv");
  res.send(
    toCsv(
      sellers.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone_number,
        business: s.shop?.name,
        category: s.shop?.category,
        district: s.shop?.district,
        verification: s.verificationStatus,
        status: s.status,
        strikes: s.activeStrikes,
        completed: s.completedCount,
        payoutMethod: s.paymentMethod,
        joined: s.createdAt,
      }))
    )
  );
};

export const providerDetail = async (req: any, res: Response) => {
  const seller = await prisma.sellers.findUnique({ where: { id: req.params.id }, include: { shop: true } });
  if (!seller) throw new NotFoundError("Provider not found");
  const [services, strikes, penalties, bookings, payouts] = await Promise.all([
    prisma.services.findMany({ where: { sellerId: seller.id }, select: { id: true, title: true, slug: true, status: true, basePrice: true, isDeleted: true, category: true } }),
    prisma.strikes.findMany({ where: { sellerId: seller.id }, orderBy: { createdAt: "desc" } }),
    prisma.penalties.findMany({ where: { sellerId: seller.id }, orderBy: { createdAt: "desc" } }),
    prisma.bookings.findMany({ where: { sellerId: seller.id, status: { notIn: ["pending_payment", "expired"] } }, orderBy: { eventDate: "desc" }, take: 30 }),
    prisma.payouts.findMany({ where: { sellerId: seller.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const { password, ...rest } = seller;
  res.json({
    provider: {
      ...rest,
      nationalIdDoc: seller.nationalIdDoc ? { name: seller.nationalIdDoc.name, url: signedUrl(seller.nationalIdDoc) } : null,
      rdbCertificateDoc: seller.rdbCertificateDoc ? { name: seller.rdbCertificateDoc.name, url: signedUrl(seller.rdbCertificateDoc) } : null,
    },
    services,
    strikes: strikes.map((s) => ({ ...s, active: s.expiresAt > new Date() })),
    penalties,
    bookings,
    payouts,
  });
};

export const verifyProvider = async (req: any, res: Response) => {
  const { decision, note } = req.body;
  if (!["approve", "reject"].includes(decision)) throw new ValidationError("Choose approve or reject");
  if (decision === "reject" && !note) throw new ValidationError("Tell the provider what to fix");
  const seller = await prisma.sellers.update({
    where: { id: req.params.id },
    data: { verificationStatus: decision === "approve" ? "approved" : "rejected", verificationNote: note || null },
  });
  await recomputeVisibility(seller.id);
  await notify({
    recipientId: seller.id,
    recipientType: "seller",
    title: decision === "approve" ? "You're verified!" : "Verification needs changes",
    message:
      decision === "approve"
        ? "Your identity documents were approved. You can now publish listings and take bookings on HUZA."
        : `We couldn't verify your account: ${note}. Please upload corrected documents.`,
    link: decision === "approve" ? "/services" : "/verification",
    type: "account",
    critical: true,
  });
  res.json({ success: true });
};

export const setProviderStatus = async (req: any, res: Response) => {
  const { action, note } = req.body;
  const seller = await prisma.sellers.findUnique({ where: { id: req.params.id } });
  if (!seller) throw new NotFoundError("Provider not found");
  if (action === "ban") {
    await prisma.sellers.update({ where: { id: seller.id }, data: { status: "banned", banRecommended: false } });
    await prisma.services.updateMany({ where: { sellerId: seller.id }, data: { status: "hidden" } });
    await notify({ recipientId: seller.id, recipientType: "seller", title: "Account banned", message: `Your HUZA provider account has been permanently banned.${note ? ` Reason: ${note}` : ""} Existing confirmed bookings must still be honoured or will be reassigned.`, critical: true });
  } else if (action === "unban" || action === "reinstate") {
    await prisma.sellers.update({ where: { id: seller.id }, data: { status: "active", banRecommended: false } });
    await evaluateSellerStatus(seller.id);
    await notify({ recipientId: seller.id, recipientType: "seller", title: "Account reinstated", message: `Your account was reinstated by HUZA.${note ? ` Note: ${note}` : ""}`, critical: true });
  } else if (action === "suspend") {
    await prisma.sellers.update({ where: { id: seller.id }, data: { status: "suspended" } });
    await notify({ recipientId: seller.id, recipientType: "seller", title: "Account suspended", message: `Your listings are hidden and you can't take new bookings.${note ? ` Reason: ${note}` : ""}`, critical: true });
  } else if (action === "dismiss_ban") {
    await prisma.sellers.update({ where: { id: seller.id }, data: { banRecommended: false } });
  } else {
    throw new ValidationError("Unknown action");
  }
  await recomputeVisibility(seller.id);
  res.json({ success: true });
};

// ───── Couples & admins ─────

export const listUsers = async (req: any, res: Response) => {
  const { q, role } = req.query;
  const { skip, limit, page } = pageParams(req.query, 25);
  const where: any = {};
  if (role) where.role = String(role);
  if (q) where.OR = [{ name: { contains: String(q), mode: "insensitive" } }, { email: { contains: String(q), mode: "insensitive" } }];
  const [users, total] = await Promise.all([
    prisma.users.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: { id: true, name: true, email: true, phone: true, role: true, isBanned: true, weddingDate: true, weddingDistrict: true, createdAt: true },
    }),
    prisma.users.count({ where }),
  ]);
  res.json({ users, total, page, pages: Math.ceil(total / limit) });
};

export const exportUsers = async (_req: any, res: Response) => {
  const users = await prisma.users.findMany({ orderBy: { createdAt: "desc" } });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=huza-users.csv");
  res.send(toCsv(users.map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, banned: u.isBanned, weddingDate: u.weddingDate, district: u.weddingDistrict, joined: u.createdAt }))));
};

export const setUserBan = async (req: any, res: Response) => {
  if (req.params.id === req.admin.id) throw new ValidationError("You can't ban yourself");
  const user = await prisma.users.update({ where: { id: req.params.id }, data: { isBanned: Boolean(req.body.banned) } });
  res.json({ success: true, isBanned: user.isBanned });
};

export const createAdmin = async (req: any, res: Response) => {
  const { name, password } = req.body;
  const email = String(req.body.email || "").toLowerCase().trim();
  if (!name || !email || !password || String(password).length < 10) {
    throw new ValidationError("Name, email and a password of at least 10 characters are required");
  }
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) {
    const updated = await prisma.users.update({ where: { email }, data: { role: "admin" } });
    return res.json({ success: true, message: `${updated.email} is now an admin` });
  }
  await prisma.users.create({ data: { name, email, password: await bcrypt.hash(password, 10), role: "admin" } });
  res.status(201).json({ success: true, message: "Admin created" });
};

export const setUserRole = async (req: any, res: Response) => {
  const role = req.body.role;
  if (!["user", "admin"].includes(role)) throw new ValidationError("Role must be user or admin");
  if (req.params.id === req.admin.id && role !== "admin") throw new ValidationError("You can't remove your own admin role");
  await prisma.users.update({ where: { id: req.params.id }, data: { role } });
  res.json({ success: true });
};

// ───── Bookings ─────

export const listBookings = async (req: any, res: Response) => {
  const { status, q } = req.query;
  const { skip, limit, page } = pageParams(req.query, 25);
  const where: any = { status: { notIn: ["pending_payment", "expired"] } };
  if (status) where.status = String(status);
  if (q) where.OR = [{ serviceTitle: { contains: String(q), mode: "insensitive" } }, { eventDistrict: { contains: String(q), mode: "insensitive" } }];
  const [bookings, total] = await Promise.all([
    prisma.bookings.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit, include: { user: { select: { name: true, email: true } } } }),
    prisma.bookings.count({ where }),
  ]);
  res.json({ bookings, total, page, pages: Math.ceil(total / limit) });
};

export const exportBookings = async (_req: any, res: Response) => {
  const bookings = await prisma.bookings.findMany({ orderBy: { createdAt: "desc" }, where: { status: { notIn: ["expired"] } } });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=huza-bookings.csv");
  res.send(
    toCsv(
      bookings.map((b) => ({
        id: b.id,
        service: b.serviceTitle,
        category: b.category,
        eventDate: b.eventDate,
        district: b.eventDistrict,
        status: b.status,
        paymentStatus: b.paymentStatus,
        price: b.price,
        paid: b.amountPaid,
        refunded: b.refundedAmount,
        provider: b.providerAmount,
        commission: b.platformAmount,
        created: b.createdAt,
      }))
    )
  );
};

export const bookingDetail = async (req: any, res: Response) => {
  const booking = await prisma.bookings.findUnique({ where: { id: req.params.id }, include: { user: { select: { name: true, email: true, phone: true } } } });
  if (!booking) throw new NotFoundError("Booking not found");
  const [seller, payments, ledger, cancellations, disputes, penalties, messages] = await Promise.all([
    prisma.sellers.findUnique({ where: { id: booking.sellerId }, select: { id: true, name: true, email: true, phone_number: true, status: true } }),
    prisma.payments.findMany({ where: { allocations: { some: { bookingId: booking.id } } } }),
    prisma.ledgerEntries.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: "asc" } }),
    prisma.cancellations.findMany({ where: { bookingId: booking.id } }),
    prisma.disputes.findMany({ where: { bookingId: booking.id } }),
    prisma.penalties.findMany({ where: { bookingId: booking.id } }),
    prisma.messages.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: "asc" } }),
  ]);
  res.json({
    booking,
    seller,
    payments,
    ledger,
    cancellations: cancellations.map((c) => ({ ...c, evidence: signFiles(c.evidence) })),
    disputes: disputes.map((d) => ({ ...d, evidence: signFiles(d.evidence) })),
    penalties,
    messages,
  });
};

// ───── Disputes (3-B) ─────

export const listDisputes = async (req: any, res: Response) => {
  const status = req.query.status || "open";
  const disputes = await prisma.disputes.findMany({ where: status === "all" ? {} : { status: String(status) }, orderBy: { createdAt: "desc" }, take: 100 });
  const bookings = await prisma.bookings.findMany({ where: { id: { in: disputes.map((d) => d.bookingId) } } });
  const byId = new Map(bookings.map((b) => [b.id, b]));
  res.json({ disputes: disputes.map((d) => ({ ...d, evidence: signFiles(d.evidence), booking: byId.get(d.bookingId) || null })) });
};

export const decideDispute = async (req: any, res: Response) => {
  const { decision, refundPercent, note } = req.body;
  if (!["accept", "reject"].includes(decision)) throw new ValidationError("Choose accept or reject");
  await resolveDispute(req.params.id, decision, refundPercent !== undefined ? Number(refundPercent) : undefined, note);
  res.json({ success: true });
};

// ───── Fines & appeals ─────

export const listPenalties = async (req: any, res: Response) => {
  const status = req.query.status || "appealed";
  const penalties = await prisma.penalties.findMany({ where: status === "all" ? {} : { status: String(status) }, orderBy: { createdAt: "desc" }, take: 100 });
  const sellers = await prisma.sellers.findMany({ where: { id: { in: penalties.map((p) => p.sellerId) } }, select: { id: true, name: true, activeStrikes: true } });
  const cancellations = await prisma.cancellations.findMany({ where: { bookingId: { in: penalties.map((p) => p.bookingId) } } });
  const sById = new Map(sellers.map((s) => [s.id, s]));
  res.json({
    penalties: penalties.map((p) => {
      const c = cancellations.find((x) => x.bookingId === p.bookingId);
      return {
        ...p,
        appealEvidence: signFiles(p.appealEvidence),
        seller: sById.get(p.sellerId) || null,
        cancellation: c ? { reasonCategory: c.reasonCategory, reason: c.reason, daysBeforeEvent: c.daysBeforeEvent, evidence: signFiles(c.evidence) } : null,
      };
    }),
  });
};

export const decidePenalty = async (req: any, res: Response) => {
  const { decision, note } = req.body;
  if (decision === "waive") await waivePenalty(req.params.id, note);
  else if (decision === "confirm") await confirmPenalty(req.params.id, note);
  else throw new ValidationError("Choose waive or confirm");
  res.json({ success: true });
};

// ───── Payouts ─────

export const listPayouts = async (req: any, res: Response) => {
  const where: any = {};
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.batch) where.batchDate = String(req.query.batch);
  const payouts = await prisma.payouts.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  const sellers = await prisma.sellers.findMany({ where: { id: { in: payouts.map((p) => p.sellerId) } }, select: { id: true, name: true } });
  const byId = new Map(sellers.map((s) => [s.id, s.name]));
  const pending = await prisma.bookings.aggregate({ where: { releasedAt: { not: null }, payoutId: null, providerAmount: { gt: 0 } }, _sum: { providerAmount: true }, _count: true });
  res.json({
    payouts: payouts.map((p) => ({ ...p, sellerName: byId.get(p.sellerId) || "—" })),
    nextBatch: { amount: pending._sum.providerAmount || 0, bookings: pending._count },
  });
};

export const retry = async (req: any, res: Response) => {
  const payout = await retryPayout(req.params.id);
  res.json({ payout });
};

/** Manual run — only on Thursdays (in case the scheduled run was missed) */
export const runPayoutsNow = async (_req: any, res: Response) => {
  // PAYOUTS_ANY_DAY=true lets you test payouts on other days (never set it in production)
  if (kigaliWeekday() !== 4 && process.env.PAYOUTS_ANY_DAY !== "true") {
    throw new ValidationError("Payouts only run on Thursdays (Kigali time).");
  }
  res.json(await runWeeklyPayouts());
};

// ───── Categories, settings, Q&A moderation ─────

export const listCategories = async (_req: any, res: Response) => {
  res.json({ categories: await prisma.categories.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] }) });
};

export const saveCategory = async (req: any, res: Response) => {
  const { name, nameRw, icon, order } = req.body;
  if (!name) throw new ValidationError("Name is required");
  const data = { name, nameRw: nameRw || null, icon: icon || null, order: Number(order) || 0 };
  const category = req.params.id
    ? await prisma.categories.update({ where: { id: req.params.id }, data })
    : await prisma.categories.create({ data: { ...data, slug: slugify(req.body.slug || name) } });
  res.json({ category });
};

export const deleteCategory = async (req: any, res: Response) => {
  const cat = await prisma.categories.findUnique({ where: { id: req.params.id } });
  if (!cat) throw new NotFoundError("Category not found");
  const inUse = await prisma.services.count({ where: { category: cat.slug, isDeleted: false } });
  if (inUse) throw new ValidationError(`${inUse} service(s) use this category. Move them first.`);
  await prisma.categories.delete({ where: { id: cat.id } });
  res.json({ success: true });
};

export const getSiteSettings = async (_req: any, res: Response) => {
  res.json({ settings: await getSettings() });
};

export const updateSiteSettings = async (req: any, res: Response) => {
  const current = await getSettings();
  const b = req.body;
  const int = (v: unknown, min: number, max: number, label: string) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < min || n > max) throw new ValidationError(`${label} must be between ${min} and ${max}`);
    return n;
  };
  const data: Record<string, any> = {};
  if (b.commissionPercent !== undefined) data.commissionPercent = int(b.commissionPercent, 0, 50, "Commission");
  if (b.bookingFee !== undefined) data.bookingFee = int(b.bookingFee, 0, 50000, "Booking fee");
  if (b.depositPercent !== undefined) data.depositPercent = int(b.depositPercent, 10, 90, "Deposit");
  if (b.balanceDueDays !== undefined) data.balanceDueDays = int(b.balanceDueDays, 1, 60, "Balance due days");
  if (b.disputeWindowHours !== undefined) data.disputeWindowHours = int(b.disputeWindowHours, 24, 240, "Dispute window");
  if (b.appealWindowDays !== undefined) data.appealWindowDays = int(b.appealWindowDays, 1, 30, "Appeal window");
  if (b.locationRevealDays !== undefined) data.locationRevealDays = int(b.locationRevealDays, 1, 60, "Location reveal days");
  if (b.heroTitle !== undefined) data.heroTitle = b.heroTitle || null;
  if (b.heroSubtitle !== undefined) data.heroSubtitle = b.heroSubtitle || null;
  if (b.heroImage && typeof b.heroImage === "string" && b.heroImage.startsWith("data:")) {
    const f = await uploadFile(b.heroImage, "hero", "site");
    await deleteFile(current.heroImage?.fileId);
    data.heroImage = { fileId: f.fileId, url: f.url };
  }
  const settings = await prisma.siteSettings.update({ where: { key: "global" }, data });
  res.json({ settings });
};

export const listQuestions = async (req: any, res: Response) => {
  const where: any = {};
  if (req.query.q) where.OR = [{ question: { contains: String(req.query.q), mode: "insensitive" } }, { answer: { contains: String(req.query.q), mode: "insensitive" } }];
  if (req.query.hidden === "true") where.isHidden = true;
  const questions = await prisma.questions.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ questions });
};

export const setQuestionHidden = async (req: any, res: Response) => {
  const q = await prisma.questions.update({ where: { id: req.params.id }, data: { isHidden: Boolean(req.body.hidden) } });
  res.json({ question: q });
};
