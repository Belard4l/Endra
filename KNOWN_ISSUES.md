# Endra — Known Issues & Deferred Fixes

Running list of things identified during development that aren't blocking right now but should be cleaned up later.

## Code quality / non-blocking

- [ ] **Fragile import path** — `apps/seller-ui/src/app/(routes)/login/page.tsx` imports `useMutation` directly from `'node_modules/@tanstack/react-query/build/modern/useMutation'` instead of the public package entry (`'@tanstack/react-query'`). Works today but will break if the package's internal build structure changes. Check other files for the same pattern (auth pages were built similarly, worth grepping for `node_modules/@tanstack` across the repo).

- [ ] **`tsconfig.json` `baseUrl` deprecation warnings** — appears in `apps/api-gateway/tsconfig.json`, `apps/auth-service/tsconfig.json`, and `apps/seller-ui/tsconfig.json`. TypeScript 7.0 will drop support for `baseUrl` in its current form. Options:
  - Short-term: add `"ignoreDeprecations": "6.0"` to silence
  - Long-term: migrate away from `baseUrl`, check if this comes from Nx's generated `tsconfig.base.json` and whether an Nx upgrade resolves it automatically

- [ ] **Unused imports in `apps/api-gateway/src/main.ts`** — `swaggerUi` and `axios` are imported but never used (flagged by TS `6133`). Either wire up Swagger docs on the gateway or remove the imports.

## Fixed (for reference)

- [x] **Seller login redirect bug** — `apps/seller-ui/src/app/(routes)/login/page.tsx` had `router.push("/")` after successful login, sending sellers to the generic landing page instead of `/profile`. Fixed by changing to `router.push("/profile")`.

## Open / needs investigation

- [ ] **`user-ui` CORS error on signup** — `POST /api/user-registration` fails with a CORS error when `user-ui` runs on port 3001 (because port 3000 was already taken). Backend CORS whitelist likely only allows `localhost:3000`. Fix: either free up port 3000 consistently, or add `localhost:3001` to allowed origins in the CORS config (probably in `auth-service` or `api-gateway` main file).

- [ ] **`/api/logged-in-user` 401 polling loop** — `apps/user-ui/src/hooks/useUser.ts` appears to poll this endpoint repeatedly even when no user is logged in, producing a steady stream of 401s in the terminal. Not necessarily broken, but noisy — worth checking if there's an unwanted `refetchInterval` or if this should only fire once / after login.

---
*Add new items above as they come up. Move fixed items to the "Fixed" section for a quick record of what's been resolved.*
