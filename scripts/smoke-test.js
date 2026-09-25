/**
 * End-to-end smoke test of the whole HUZA flow against running services.
 *
 *   1. Start the backend (npm run dev) with FLUTTERWAVE_SECRET_KEY empty (mock payments)
 *      and PAYOUTS_ANY_DAY=true, pointing at a THROWAWAY database.
 *   2. node scripts/smoke-test.js
 *
 * It creates test accounts, bookings, cancellations, disputes and payouts, so never run it
 * against production data.
 */
require("dotenv").config();
const { execSync } = require("child_process");
const Redis = require("ioredis");
const { PrismaClient } = require("@prisma/client");

const API = process.env.SMOKE_API || "http://localhost:8080";
const redis = new Redis(process.env.REDIS_DATABASE_URI || "redis://localhost:6379");
const prisma = new PrismaClient();
const run = Date.now().toString(36);
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let passed = 0;
const failures = [];

class Client {
  constructor(name) {
    this.name = name;
    this.cookies = {};
  }
  async req(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    const cookie = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(";");
      const idx = pair.indexOf("=");
      const k = pair.slice(0, idx);
      const v = pair.slice(idx + 1);
      if (v) this.cookies[k] = v;
      else delete this.cookies[k];
    }
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data };
  }
  get(p) { return this.req("GET", p); }
  post(p, b) { return this.req("POST", p, b || {}); }
  put(p, b) { return this.req("PUT", p, b || {}); }
  patch(p, b) { return this.req("PATCH", p, b || {}); }
}

const check = (label, condition, detail) => {
  if (condition) {
    passed++;
    console.log(`  ✔ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✘ ${label}${detail !== undefined ? ` → ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 600)}` : ""}`);
  }
};
const expectOk = (label, r) => check(label, r.status >= 200 && r.status < 300, `${r.status} ${JSON.stringify(r.data).slice(0, 600)}`);

const kigaliToday = () => new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const otpFor = async (rawEmail) => {
  const email = rawEmail.toLowerCase();
  for (let i = 0; i < 20; i++) {
    const otp = await redis.get(`otp:${email}`);
    if (otp) return otp;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("OTP not found for " + email);
};
const clearOtpLimits = async (email) => redis.del(`otp_cooldown:${email}`, `otp_request_count:${email}`);

const description = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");

async function makeProvider(label, category, price) {
  const c = new Client(label);
  const email = `${label}-${run}@test.huza`;
  let r = await c.post("/auth/api/seller-registration", { name: `${label} Owner`, email, password: "password123", phone_number: "0788123456", accountType: "individual" });
  expectOk(`${label}: registration sends OTP`, r);
  r = await c.post("/auth/api/verify-seller", { name: `${label} Owner`, email, password: "password123", phone_number: "0788123456", accountType: "individual", otp: await otpFor(email) });
  expectOk(`${label}: verify OTP creates account + session`, r);
  r = await c.post("/auth/api/create-shop", { name: `${label} Studio`, bio: "We make weddings beautiful", address: "KG 11 Ave", district: "Gasabo", category });
  expectOk(`${label}: business profile`, r);
  r = await c.post("/auth/api/save-seller-payment", { type: "momo", phone_number: "0788123456", name: `${label} Owner`, network: "MTN" });
  expectOk(`${label}: MoMo payout method`, r);
  r = await c.post("/auth/api/seller-verification", { nationalIdNumber: "1199780012345678", nationalIdDoc: PNG });
  expectOk(`${label}: verification submitted`, r);
  r = await c.get("/auth/api/logged-in-seller");
  check(`${label}: session shows pending verification`, r.data?.seller?.verificationStatus === "pending", r.data);
  return { c, id: r.data?.seller?.id, email, price, category };
}

async function makeService(p, title) {
  const r = await p.c.post("/catalog/api/seller/services", {
    title,
    category: p.category,
    shortDescription: "Beautiful wedding photos",
    description,
    basePrice: p.price,
    serviceArea: ["Gasabo", "Kicukiro"],
    travelFee: 20000,
    included: ["300 edited photos", "Online gallery"],
    excluded: ["Printed album"],
    requirements: "Power socket and a table",
    images: [PNG],
    optionGroups: [
      { name: "Hours of coverage", type: "single", required: true, choices: [{ label: "6 hours", priceDelta: 0 }, { label: "10 hours", priceDelta: 100000 }] },
      { name: "Add-ons", type: "multiple", required: false, choices: [{ label: "Drone", priceDelta: 50000 }] },
    ],
    status: "published",
  });
  expectOk(`${p.c.name}: create & publish "${title}"`, r);
  return r.data?.service;
}

(async () => {
  console.log(`\nHUZA smoke test against ${API} (run ${run})\n`);

  // ── Admin ──
  const adminEmail = `admin-${run}@test.huza`;
  execSync(`node scripts/create-admin.js "Smoke Admin" ${adminEmail} "admin-password-123"`, { stdio: "inherit" });
  const admin = new Client("admin");
  expectOk("admin login", await admin.post("/auth/api/login-admin", { email: adminEmail, password: "admin-password-123" }));

  const cats = await new Client("anon").get("/catalog/api/categories");
  check("categories seeded", cats.data?.categories?.length >= 5, cats.data);

  // ── Providers ──
  const photoA = await makeProvider("photoA", "photography", 500000);
  const photoB = await makeProvider("photoB", "photography", 520000);
  let r = await photoA.c.post("/catalog/api/seller/services", { title: "x" });
  check("validation rejects an incomplete listing", r.status === 400, r);
  r = await photoA.c.post("/catalog/api/seller/services", {
    title: "Call us now", category: "photography", shortDescription: "call 0788123456", description, basePrice: 1000, serviceArea: ["Gasabo"], included: ["x"], requirements: "y", status: "draft",
  });
  check("contact details blocked in listings", r.status === 400 && /contains/.test(r.data?.message), r);

  for (const p of [photoA, photoB]) {
    expectOk(`admin approves ${p.c.name}`, await admin.post(`/admin/api/providers/${p.id}/verify`, { decision: "approve" }));
  }
  const svcA = await makeService(photoA, "Full-day wedding photography");
  const svcB = await makeService(photoB, "Cinematic wedding photography");
  if (!svcA || !svcB) throw new Error("Cannot continue without services");

  // ── Couple ──
  const couple = new Client("couple");
  const coupleEmail = `couple-${run}@test.huza`;
  expectOk("couple registration", await couple.post("/auth/api/user-registration", { name: "Aline Uwase", email: coupleEmail, password: "password123" }));
  expectOk("couple verify", await couple.post("/auth/api/verify-user", { name: "Aline Uwase", email: coupleEmail, password: "password123", otp: await otpFor(coupleEmail) }));
  expectOk("couple login", await couple.post("/auth/api/login-user", { email: coupleEmail, password: "password123" }));
  expectOk("couple profile", await couple.put("/auth/api/user-profile", { phone: "0788000111", weddingDistrict: "Gasabo", weddingDate: addDays(kigaliToday(), 100) }));

  // ── Browse ──
  r = await couple.get("/catalog/api/services?category=photography");
  check("browse shows both services", r.data?.services?.length >= 2, r.data);
  r = await couple.get(`/catalog/api/services/${svcA.slug}`);
  expectOk("service detail", r);
  const hours = svcA.optionGroups[0];
  const selections = [{ groupId: hours.id, choiceIds: [hours.choices[1].id] }];
  r = await couple.post(`/catalog/api/services/${svcA.id}/quote`, { selections, eventDistrict: "Musanze" });
  check("quote = base + option + travel fee", r.data?.price === 500000 + 100000 + 20000, r.data);
  const date1 = addDays(kigaliToday(), 100);
  r = await couple.get(`/catalog/api/services/${svcA.id}/availability?date=${date1}`);
  check("availability check", r.data?.available === true, r.data);
  r = await couple.post(`/catalog/api/services/${svcA.id}/questions`, { question: "Can I whatsapp you on 0788123456?" });
  check("contact details blocked in questions", r.status === 400, r);
  r = await couple.post(`/catalog/api/services/${svcA.id}/questions`, { question: "Do you travel to Musanze?" });
  expectOk("ask a public question", r);
  r = await photoA.c.post(`/catalog/api/seller/questions/${r.data?.question?.id}/answer`, { answer: "Yes, for a small travel fee." });
  expectOk("provider answers publicly", r);
  expectOk("ask a second question", await couple.post(`/catalog/api/services/${svcA.id}/questions`, { question: "Can you shoot a Gusaba ceremony too?" }));
  r = await photoA.c.get("/catalog/api/seller/questions?status=unanswered");
  check("unanswered questions filter", r.data?.questions?.length === 1, r.data);
  r = await couple.get("/catalog/api/recommendations");
  check("recommendations respond", Array.isArray(r.data?.recommendations), r.data);

  // ── Booking 1: deposit, balance, reschedule, couple cancellation quote ──
  r = await couple.post("/booking/api/checkout", {
    items: [{ serviceId: svcA.id, eventDate: date1, startTime: "10:00", selections }],
    paymentPlan: "deposit",
    eventLocation: "Intare Arena, Rusororo",
    eventDistrict: "Gasabo",
  });
  expectOk("checkout (deposit plan)", r);
  const settings = (await couple.get("/catalog/api/settings/public")).data.settings;
  const expectedDeposit = Math.round(600000 * settings.depositPercent / 100) + settings.bookingFee;
  check("amount due now = deposit + booking fee", r.data?.amount === expectedDeposit, r.data);
  check("mock payment link", /checkout\/mock/.test(r.data?.paymentLink || ""), r.data);
  expectOk("mock payment succeeds", await couple.post("/booking/api/payments/mock-complete", { txRef: r.data.txRef }));
  r = await couple.get(`/booking/api/payments/verify?tx_ref=${r.data.txRef}`);
  check("payment verified", r.data?.status === "successful", r.data);
  let mine = await couple.get("/booking/api/my-bookings");
  const b1 = mine.data?.bookings?.find((b) => b.serviceId === svcA.id);
  check("booking confirmed with deposit", b1?.status === "confirmed" && b1?.paymentStatus === "deposit_paid", b1);

  r = await couple.post(`/booking/api/checkout`, { items: [{ serviceId: svcA.id, eventDate: date1, startTime: "15:00", selections }], paymentPlan: "full", eventLocation: "Somewhere nice", eventDistrict: "Gasabo" });
  check("capacity: same provider/date can't be double booked", r.status === 400, r);

  r = await photoA.c.get(`/booking/api/seller/bookings/${b1.id}`);
  check("provider can't see venue before full payment", r.data?.booking?.eventLocation === null, r.data?.booking);

  r = await couple.post(`/booking/api/bookings/${b1.id}/pay-balance`);
  expectOk("balance payment link", r);
  await couple.post("/booking/api/payments/mock-complete", { txRef: r.data.txRef });
  r = await couple.get(`/booking/api/bookings/${b1.id}`);
  check("balance paid → fully paid", r.data?.booking?.paymentStatus === "paid" && r.data?.remaining === 0, r.data?.booking);

  const date1b = addDays(kigaliToday(), 110);
  expectOk("free reschedule", await couple.post(`/booking/api/bookings/${b1.id}/reschedule`, { eventDate: date1b }));
  r = await couple.post(`/booking/api/bookings/${b1.id}/reschedule`, { eventDate: addDays(kigaliToday(), 120) });
  check("second reschedule refused", r.status === 400, r);
  r = await couple.get(`/booking/api/bookings/${b1.id}/cancel-quote`);
  check("cancellation quote: >90 days → 100%", r.data?.quote?.refundPercent === 100, r.data);

  // ── Booking 2: provider cancels → alternatives → replacement; appeal waived ──
  const date2 = addDays(kigaliToday(), 40);
  r = await couple.post("/booking/api/checkout", { items: [{ serviceId: svcA.id, eventDate: date2, startTime: "09:00", selections }], paymentPlan: "full", eventLocation: "Kigali Serena", eventDistrict: "Gasabo" });
  expectOk("checkout booking 2 (full)", r);
  await couple.post("/booking/api/payments/mock-complete", { txRef: r.data.txRef });
  mine = await couple.get("/booking/api/my-bookings");
  const b2 = mine.data.bookings.find((b) => b.eventDate === date2);
  expectOk("provider cancels booking 2", await photoA.c.post(`/booking/api/seller/bookings/${b2.id}/cancel`, { reasonCategory: "illness", reason: "I was admitted to hospital" }));
  r = await couple.get(`/booking/api/bookings/${b2.id}`);
  check("couple sees alternatives (provider B)", r.data?.alternatives?.some((a) => a.id === svcB.id), r.data?.alternatives);
  const hoursB = svcB.optionGroups[0];
  r = await couple.post(`/booking/api/bookings/${b2.id}/choose-replacement`, { serviceId: svcB.id, selections: [{ groupId: hoursB.id, choiceIds: [hoursB.choices[1].id] }] });
  expectOk("couple picks replacement", r);
  const replacement = r.data?.booking;
  check("replacement is confirmed with moved payment", replacement?.status === "confirmed" && replacement?.amountPaid > 0, replacement);
  r = await photoA.c.get("/booking/api/seller/penalties");
  const fine = r.data?.penalties?.find((p) => p.bookingId === b2.id);
  check("fine pending for 40 days' notice (10%)", fine?.status === "pending" && fine?.amount === Math.round(600000 * 0.1), fine);
  expectOk("provider appeals with evidence", await photoA.c.post(`/booking/api/seller/penalties/${fine.id}/appeal`, { text: "Hospital admission, medical certificate attached here.", evidence: [PNG] }));
  expectOk("admin waives the fine", await admin.post(`/admin/api/penalties/${fine.id}/decide`, { decision: "waive", note: "Valid medical emergency" }));
  r = await photoA.c.get("/booking/api/seller/penalties");
  check("waived fine adds no strike", r.data?.strikes?.length === 0 && r.data?.penalties?.find((p) => p.id === fine.id)?.status === "waived", r.data);

  // ── Booking 3: delivered, dispute, partial refund, release, payout, review ──
  const date3 = addDays(kigaliToday(), 5);
  r = await couple.post("/booking/api/checkout", { items: [{ serviceId: svcA.id, eventDate: date3, startTime: "11:00", selections }], paymentPlan: "deposit", eventLocation: "Heaven Garden", eventDistrict: "Kicukiro" });
  expectOk("checkout booking 3 (deposit requested, event in 5 days → full)", r);
  check("event within balance window charges in full", r.data?.amount === 600000 + settings.bookingFee, r.data);
  await couple.post("/booking/api/payments/mock-complete", { txRef: r.data.txRef });
  mine = await couple.get("/booking/api/my-bookings");
  const b3 = mine.data.bookings.find((b) => b.eventDate === date3);
  r = await photoA.c.get(`/booking/api/seller/bookings/${b3.id}`);
  check("venue revealed (fully paid, within 14 days)", r.data?.booking?.eventLocation === "Heaven Garden", r.data?.booking);
  r = await photoA.c.post(`/booking/api/seller/bookings/${b3.id}/complete`);
  check("can't mark delivered before the event", r.status === 400, r);
  // Time travel: move the event to yesterday
  await prisma.bookings.update({ where: { id: b3.id }, data: { eventDate: addDays(kigaliToday(), -1) } });
  expectOk("provider marks delivered", await photoA.c.post(`/booking/api/seller/bookings/${b3.id}/complete`));
  expectOk("couple reports late arrival", await couple.post(`/booking/api/bookings/${b3.id}/dispute`, { problemType: "late_arrival", description: "The photographer arrived three hours late and missed the vows.", evidence: [PNG] }));
  expectOk("provider responds", await photoA.c.post(`/booking/api/seller/bookings/${b3.id}/dispute-response`, { response: "Traffic jam on the way, I apologise." }));
  r = await admin.get("/admin/api/disputes?status=open");
  const dispute = r.data?.disputes?.find((d) => d.bookingId === b3.id);
  expectOk("admin confirms 20% refund", await admin.post(`/admin/api/disputes/${dispute.id}/decide`, { decision: "accept", refundPercent: 20, note: "Late arrival confirmed" }));
  const settled = await prisma.bookings.findUnique({ where: { id: b3.id } });
  const fee = settled.collectionFee;
  const feeOnService = Math.round((fee * (settled.amountPaid - settled.bookingFee)) / settled.amountPaid);
  const net = settled.amountPaid - settled.refundedAmount - settled.bookingFee - feeOnService;
  check("refund = 20% of service paid", settled.refundedAmount === 120000, settled);
  check("released with 85/15 split after fees", settled.status === "released" && settled.providerAmount === net - Math.round(net * 0.15), { net, provider: settled.providerAmount, platform: settled.platformAmount });

  // Payouts include earnings released before Thursday 00:00 — pretend this was released yesterday
  await prisma.bookings.update({ where: { id: b3.id }, data: { releasedAt: new Date(Date.now() - 36 * 3600 * 1000) } });
  r = await admin.get("/admin/api/payouts");
  check("admin sees next Thursday batch", r.data?.nextBatch?.amount === settled.providerAmount, r.data?.nextBatch);
  r = await photoA.c.get("/booking/api/seller/dashboard");
  check("provider dashboard shows next payout", r.data?.stats?.nextPayout === settled.providerAmount && r.data?.stats?.unansweredQuestions === 1, r.data?.stats);
  r = await admin.post("/admin/api/payouts/run");
  expectOk("admin runs payouts (PAYOUTS_ANY_DAY)", r);
  r = await photoA.c.get("/booking/api/seller/payouts");
  const payout = r.data?.payouts?.[0];
  check("provider A payout sent (mock)", payout?.status === "successful" && payout?.amount === settled.providerAmount, payout);
  expectOk("couple reviews the released booking", await couple.post(`/booking/api/bookings/${b3.id}/review`, { rating: 4, comment: "Great photos despite the delay" }));
  r = await couple.get(`/catalog/api/services/${svcA.id}/reviews`);
  check("review is public", r.data?.reviews?.length === 1, r.data);

  // ── Booking 1 cancelled by couple (100% of service refunded, fee kept) ──
  r = await couple.post(`/booking/api/bookings/${b1.id}/cancel`, { reason: "Change of plans" });
  check("couple cancellation refunds 100% of service", r.data?.refund === 600000, r.data);

  // ── Wedding-day chat gate ──
  r = await couple.post(`/booking/api/bookings/${replacement.id}/messages`, { text: "hello" });
  check("chat closed before the wedding day", r.status === 400, r);

  // ── Admin views ──
  for (const path of ["/admin/api/dashboard", "/admin/api/providers", `/admin/api/providers/${photoA.id}`, "/admin/api/bookings", `/admin/api/bookings/${b3.id}`, "/admin/api/payouts", "/admin/api/penalties?status=all", "/admin/api/users", "/admin/api/settings", "/admin/api/categories", "/admin/api/questions"]) {
    expectOk(`admin GET ${path}`, await admin.get(path));
  }
  r = await photoA.c.get("/booking/api/seller/dashboard");
  expectOk("provider dashboard", r);
  r = await couple.get("/booking/api/notifications");
  check("couple received notifications", r.data?.notifications?.length > 3, r.data);
  r = await couple.get("/catalog/api/providers");
  expectOk("providers list", r);
  r = await couple.get(`/catalog/api/services/${svcA.id}/also-booked`);
  expectOk("also-booked", r);

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) console.log("Failed:\n - " + failures.join("\n - "));
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(failures.length ? 1 : 0);
})().catch(async (err) => {
  console.error("Smoke test crashed:", err);
  console.log(`\n${passed} passed, ${failures.length} failed before crash`);
  if (failures.length) console.log("Failed:\n - " + failures.join("\n - "));
  await prisma.$disconnect().catch(() => undefined);
  redis.disconnect();
  process.exit(1);
});
