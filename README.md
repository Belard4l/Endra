# HUZA — wedding services marketplace (Rwanda)

Couples find, book and pay for their whole wedding in one place. Providers (venues, photographers,
caterers, decorators, DJs…) list their services, and HUZA holds each payment until the service is
delivered, then pays the provider every Thursday to MoMo or a bank account.

> Repository / package name: **Endra** (`@endra/source`). Product name: **HUZA**.
> **New here? Follow [SETUP.md](./SETUP.md)** — step-by-step instructions to run everything.

## Apps

| App | Port | What it is |
|---|---|---|
| `apps/user-ui` | 3000 | Couple website (Next.js, PWA, English + Kinyarwanda) |
| `apps/seller-ui` | 3001 | Provider dashboard (Next.js) |
| `apps/admin-ui` | 3002 | Admin dashboard (Next.js) |
| `apps/api-gateway` | 8080 | Single entry point; routes `/auth`, `/catalog`, `/booking`, `/admin`; rate limiting |
| `apps/auth-service` | 6001 | Accounts, OTP email verification, sessions, provider onboarding & verification documents |
| `apps/catalog-service` | 6002 | Categories, listings, pricing options, availability, public Q&A, reviews, search, recommendations |
| `apps/booking-service` | 6003 | Basket checkout, Flutterwave payments & webhooks, bookings lifecycle, cancellations, disputes, fines, strikes, Thursday payouts, wedding-day chat, notifications, scheduled jobs |
| `apps/admin-service` | 6004 | Verification, disputes, fine appeals, payouts, users, categories, settings, Q&A moderation, CSV exports |

Shared code lives in `packages/`:

- `packages/domain` — the business rules (money, refunds, settlement, penalties, strikes, visibility, payouts, availability, alternatives)
- `packages/utils/config.ts` — **all policy numbers in one place** (cancellation tiers, fine %, strike levels, dispute presets, districts, default categories)
- `packages/libs` — Prisma, Redis, Flutterwave, ImageKit, email (Nodemailer + EJS), SMS (Africa's Talking), notifications
- `packages/middleware` — role-based authentication (separate cookies for couples, providers and admins)

Database: MongoDB (Prisma, `prisma/schema.prisma`). Cache/locks/OTPs: Redis (Upstash).

## Commands

```bash
npm install                 # also runs `prisma generate`
npx prisma db push          # sync indexes to MongoDB
npm run create-admin -- "Your Name" you@example.com "a-strong-password"
npm run dev                 # all 5 backend services
npm run dev:web             # the 3 websites
```

## Key rules (summary)

- **Payments**: couples pay HUZA (MoMo or card via Flutterwave), in full or 30% deposit + balance 14 days before the event.
- **Earnings**: provider gets 85% of the service amount after the processing fee is shared; HUZA keeps 15%. A small booking fee paid by the couple covers payout transfer fees.
- **Payouts**: every Thursday 09:00 Kigali time, no holiday exceptions, no minimum; everything released by Wednesday 23:59, minus confirmed fines.
- **Release**: provider marks delivered (or it's automatic the day after the event); the couple has 72 h to confirm or report a problem.
- **Couple cancels**: >90 days 100% refund, 30–90 days 50%, <30 days 0%; one free reschedule.
- **Provider cancels**: couple is offered alternatives (same category, free that day, ±15% price) or a full refund; fine 10/20/30% by notice (50% no-show), waivable on appeal with evidence; confirmed fines add a strike.
- **Strikes** (12-month window): 1 warning · 2 lower ranking · 3 suspended · 4+ admin reviews a ban.
- **No pre-wedding chat**: required listing template + public Q&A (contact details blocked); venue revealed ~14 days before once fully paid; chat and phone contact open on the wedding day.

See `KNOWN_ISSUES.md` for what's still open.
