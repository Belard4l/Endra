# HUZA (Endra) — Known issues & open items

Running list of things that aren't blocking right now but need attention. Move items to "Fixed" when done.

## Before launch (must do)

- [ ] **Legal & tax review (decision 11)** — holding customer funds (Flutterwave licence vs. own BNR licence), VAT on the 15% commission + EBM receipts (RRA), Rwanda 2021 personal data protection law, and proper couple/provider terms. `/terms` is a placeholder.
- [ ] **Kinyarwanda translations** — `apps/user-ui/src/lib/i18n.tsx` and category names were written without a native-speaker review. Have them checked.
- [ ] **Flutterwave account confirmation** — confirm RWF MoMo payouts (`account_bank: "MPS"`) and bank payouts are enabled for the account, the real bank codes returned by `/banks/RW`, and the actual fee schedule (payout fee estimates in `packages/domain/payouts.ts`).
- [ ] **Run exactly one `booking-service` instance** in production (it owns the scheduled jobs: Thursday payouts, releases, reminders).
- [ ] **Flutterwave float** — keep enough RWF balance for Thursday payouts; add an admin alert when the balance is low (not built).

## Product gaps / later

- [ ] Only the couple site (user-ui) is translated; provider and admin dashboards are English only.
- [ ] Only the couple site is a PWA; provider dashboard could also be installable.
- [ ] Price-tier pricing by date (weekend/peak season) is not supported — use option groups for now.
- [ ] Replacement costing more than the original: the couple pays the difference as a balance. Consider letting HUZA cover part of the gap from the provider's fine.
- [ ] Recommendations are rule-based (context + similarity + "also booked"). The tutorial's TensorFlow model can be added once there is enough real booking data; interest events are already recorded in `userEvents`.
- [ ] No Kafka / real-time logger service (tutorial Part 3). Events are written directly to MongoDB; revisit if traffic grows.
- [ ] Chat is polling-based (every 8 s) and only open on the wedding day; WebSockets could replace polling later.
- [ ] Google sign-in button was removed (it was never wired up).
- [ ] Automated tests: only the end-to-end smoke test (`scripts/smoke-test.js`, runs in CI). Add unit tests for `packages/domain` money rules.
- [ ] `imagekit` npm package is deprecated in favour of `@imagekit/nodejs` — migrate when convenient.
- [ ] Custom domains, push notifications (web push), mobile apps — later.

## Code quality / non-blocking

- [ ] **`tsconfig.json` `baseUrl`** — still used (frontends need it for the `@/` alias). TypeScript 7 will drop it; migrate to `paths` without `baseUrl` when upgrading.
- [ ] `noImplicitReturns` was turned off in `tsconfig.base.json` (Express handlers intentionally return early).

## Fixed (for reference)

- [x] **Seller login redirect** — now goes to the dashboard (or onboarding if unfinished).
- [x] **user-ui CORS error on signup** — gateway and services allow ports 3000/3001/3002 via `CORS_ORIGINS`; frontends have fixed ports.
- [x] **`/api/logged-in-user` 401 polling loop** — `useUser` no longer retries or refetches on focus, and the axios interceptor never redirects for the session check.
- [x] **Fragile `useMutation` import** — pages were rewritten to import from `@tanstack/react-query`.
- [x] **Unused imports in api-gateway** — gateway rewritten.
- [x] **Role guards never called `next()`** (`isSeller`/`isUser`) — fixed; auth is now per-role cookies (`authenticate("user" | "seller" | "admin")`).
- [x] **OTP helpers kept going after a limit** — they now throw.
- [x] **Refresh token errors returned instead of passed on** — fixed.
- [x] **Missing `forgot-password-seller-mail` template** — added.
- [x] **Password reset without a verified OTP** — reset now requires a verified OTP within 10 minutes.
- [x] **`ipKeyGenerator(req)`** was called with the request instead of the IP — fixed.
- [x] **Stripe removed**; payments now use Flutterwave (with a mock mode for development).

---
*Add new items above as they come up.*
