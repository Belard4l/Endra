# HUZA — setup guide (step by step)

This guide assumes Windows + VS Code, the project at `E:\pROJECTs\DBridge\Endra`, and that you
already have Node.js and Git installed. Every command is typed in the **VS Code terminal**
(`Ctrl + ù` / View → Terminal) **inside the project folder**.

---

## 1. Get the new code

The full build is on the branch **`huza-full-build`** (your `main` branch is untouched).

1. Your `.env` file is not in Git, so it stays safe during this. As a precaution, copy it somewhere
   (e.g. `E:\pROJECTs\env-backup.txt`).
2. If you have uncommitted changes, save them first:
   ```bash
   git status
   git stash            # only if git status shows changes you want to keep for later
   ```
3. Download and switch to the branch:
   ```bash
   git fetch origin
   git checkout huza-full-build
   ```
4. Check: `git branch` should show `* huza-full-build`.

> When you're happy with it, merge into `main` on GitHub (Pull requests → New → base `main`,
> compare `huza-full-build` → Create → Merge).

## 2. Install packages

```bash
npm install
```

- This also runs `prisma generate` automatically.
- If you see `EPERM` / "file in use" errors on Windows: close VS Code terminals running the app,
  stop any `node` processes (Task Manager → Node.js → End task), then run `npm install` again.
- Node.js **20 or newer** is required (`node -v` to check).

## 3. Create your `.env`

1. In the project root, copy `.env.example` → `.env`
   (VS Code: right-click `.env.example` → Copy → Paste → rename to `.env`).
   If you already have a `.env`, open both and copy the missing lines across.
2. Fill in:

| Variable | What to put |
|---|---|
| `DATABASE_URL` | Your MongoDB Atlas connection string. **Use a new database name** at the end, e.g. `…mongodb.net/huza?retryWrites=true&w=majority` (see note below). |
| `REDIS_DATABASE_URI` | Your Upstash URL, starting with `rediss://` (the HUZA database you already created). |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` | Two different long random strings. Generate each with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| everything else | Leave empty for now — the app runs in **development mode** (see below). |

> **Why a new database name?** The data model changed a lot (products → services, new booking
> and payout collections, provider verification). Old test accounts from the tutorial build would
> not match the new shape. A fresh database (just change the name after `.net/`) avoids errors.
> Your old data stays in the old database if you ever need it.

**Development mode** (empty keys) means:
- **Emails/OTP codes** are printed in the backend terminal instead of being sent (look for `[email:dev]`).
- **SMS** are printed (`[sms:dev]`).
- **Payments** use a built-in **test payment page** (no real money) — see step 7.
- **Images** are stored inside the database (max 1.5 MB each) instead of ImageKit.

Also check the two old typos are gone from your `.env`: the variable must be `REDIS_DATABASE_URI`
(not `DIS_DATABASE_URI`). `STRIPE_SECRET_KEY` is no longer used — you can delete it.

## 4. Prepare the database

```bash
npx prisma db push
```
This creates the collections and indexes in MongoDB. Run it again whenever `prisma/schema.prisma` changes.

## 5. Create your admin account

```bash
npm run create-admin -- "Belard Mwambuka" your-email@example.com "a-strong-password-10+"
```
(The `--` matters. Use a password of at least 10 characters.)

## 6. Run everything

Open **two** terminals (the `+` in the terminal panel):

**Terminal 1 — backend (5 services):**
```bash
npm run dev
```
Wait until you see lines like `[auth-service] listening`, `[catalog-service] listening`,
`[booking-service] listening`, `[admin-service] listening` and `[api-gateway] listening`.

**Terminal 2 — websites:**
```bash
npm run dev:web
```

Open:
- Couples: http://localhost:3000
- Providers: http://localhost:3001
- Admin: http://localhost:3002

> If a port is busy (e.g. 3000 is taken), find and stop the other program, because cookies and
> CORS expect exactly these ports. To see what uses a port: `netstat -ano | findstr :3000`, then
> end that PID in Task Manager (Details tab).

## 7. Test the whole flow (development mode)

1. **Provider signs up** at http://localhost:3001/signup → the 6-digit code appears in Terminal 1
   (`[email:dev] … "otp":"123456"`). Complete business profile → payout (MoMo) → verification
   (any 16 digits + any small image as the ID).
2. **Admin approves** at http://localhost:3002 → Providers → open the provider → Approve.
3. **Provider publishes a listing**: http://localhost:3001 → My services → New listing → fill the
   template (≥ 50-word description, at least one photo, districts, what's included) → Publish.
   Optionally add pricing options (e.g. "Guests": 100 / 200 (+50,000) / 300 (+100,000)).
4. **Couple signs up** at http://localhost:3000/signup (OTP again in Terminal 1), opens the
   service, picks a date and options → Add to basket → Basket → enter venue + district → choose
   deposit or full → Continue to payment → you land on the **test payment page** → "Simulate
   successful MoMo payment". The booking is confirmed; notifications appear for both sides.
5. Try the rest: ask a public question (try typing a phone number — it's blocked), reschedule,
   cancel (see the refund tier), provider cancels (couple sees alternatives), etc.
6. **Delivery & payouts**: bookings can only be marked delivered on/after the event date. To test
   quickly, book tomorrow's date, then after that date the provider clicks "Mark as delivered",
   the couple confirms, and in `.env` set `PAYOUTS_ANY_DAY=true` (restart Terminal 1) so the admin
   can click **Payouts → Run Thursday payouts now**. Set it back to `false` afterwards.

## 8. Connect the real services (before launch)

Do these one at a time; after editing `.env`, stop Terminal 1 (`Ctrl + C`) and run `npm run dev` again.

### 8.1 Email (Gmail)
1. Google Account → Security → turn on **2-Step Verification**.
2. Security → **App passwords** → create one called "HUZA" → copy the 16 characters.
3. `.env`: `SMTP_USER=your@gmail.com`, `SMTP_PASS=the16chars` (no spaces), keep `SMTP_HOST`,
   `SMTP_PORT=465`, `SMTP_SERVICE=gmail`.

### 8.2 ImageKit (photos & private documents)
1. Sign up at imagekit.io (free tier is fine to start).
2. Dashboard → Developer options → copy **Public key**, **Private key**, **URL endpoint**.
3. Put them in `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`.
4. ID documents and dispute evidence are uploaded as **private files**; admins get short-lived signed links.

### 8.3 Flutterwave (payments & payouts)
1. Create a business account at flutterwave.com (country: Rwanda). Complete **KYC** — you'll need
   your RDB registration, TIN, a Rwandan bank account and a director's ID.
2. Start in **Test mode**: Settings → API keys → copy the **Secret key** → `FLUTTERWAVE_SECRET_KEY`.
3. Settings → **Webhooks**:
   - URL: `https://YOUR-PUBLIC-API/booking/api/webhooks/flutterwave`
     (in development use a tunnel such as `ngrok http 8080` and paste the https URL it gives + that path).
   - Create a **Secret hash** (any long random string) → put the same value in `FLUTTERWAVE_SECRET_HASH`.
   - Enable events for charges and transfers.
4. Test a booking with Flutterwave's test MoMo numbers/cards (from their docs).
5. Ask Flutterwave to confirm for your account: (a) RWF **MoMo payouts** (`account_bank: "MPS"`) and
   **bank payouts** are enabled, (b) whether you may hold customer funds before paying providers
   under their licence (see Legal below), (c) your exact fees (the admin dashboard assumes MoMo payout
   500 RWF and bank payout 2,000 RWF).
6. When live: switch to live keys and **keep enough balance** in your Flutterwave RWF wallet for Thursday payouts.

### 8.4 SMS (Africa's Talking)
1. Sign up at africastalking.com → you start in the **sandbox** (username `sandbox`).
2. Settings → API key → `AT_API_KEY`; `AT_USERNAME=sandbox` for testing.
3. For live SMS: create a live app, top up, request a **Sender ID** ("HUZA") → set `AT_USERNAME` to
   your app username and `AT_SENDER_ID=HUZA`.

## 9. Deploying (outline)

- **Frontends (3 apps)** → Vercel: import the repo three times, each with root = repository root and
  build command `npx nx build user-ui` (or `seller-ui` / `admin-ui`), output `apps/<app>/.next`.
  Set `NEXT_PUBLIC_SERVER_URI` (your public API URL), `NEXT_PUBLIC_SELLER_UI_URL`, `NEXT_PUBLIC_USER_UI_URL`.
- **Backend (5 services)** → Railway or Render (or one small VPS with PM2). Build with
  `npx nx build <service>` and start `node apps/<service>/dist/main.js`. Give every service the same `.env`.
- **Important:** run **exactly one instance of `booking-service`** — it runs the scheduled jobs
  (Thursday payouts, releases, reminders). Two instances would run them twice.
- Use a domain like `huza.rw`: `api.huza.rw` (gateway), `huza.rw` (couples), `pro.huza.rw`,
  `admin.huza.rw`; set `CORS_ORIGINS` to those three and `COOKIE_DOMAIN=.huza.rw`.
- Update the Flutterwave webhook URL to `https://api.huza.rw/booking/api/webhooks/flutterwave`.

## 10. Legal & tax (decision 11 — before launch)

Get a lawyer/accountant to confirm: holding customer funds (Flutterwave's licence vs. your own /
BNR rules), VAT on the 15% commission and EBM receipts (RRA), Rwanda's 2021 personal data
protection law (you store IDs, phones, addresses), and to write the couple/provider terms
(fines, payouts, refunds, bans). The `/terms` page is a placeholder until then.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Environment variable not found: DATABASE_URL` | `.env` missing or not in the project root. |
| CORS error in the browser | Make sure the site runs on exactly 3000/3001/3002 and `CORS_ORIGINS` lists them. |
| "Unauthorized" right after login | Use `http://localhost:…` (not 127.0.0.1) for all three sites so cookies match. |
| OTP never arrives | In development it's printed in Terminal 1. With Gmail, check the App Password. |
| `PrismaClientInitializationError` | Check `DATABASE_URL` and that your IP is allowed in Atlas → Network Access. |
| Payments stay "processing" | Check the Flutterwave webhook URL/secret hash; the page also re-checks for ~30 s. |
