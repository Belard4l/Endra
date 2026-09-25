/**
 * CI helper: takes screenshots of the three websites using the accounts the
 * smoke test created. Output: ./shots/*.png
 */
const { chromium } = require("playwright");
const fs = require("fs");

const acc = JSON.parse(fs.readFileSync(process.env.SMOKE_ACCOUNTS_FILE, "utf8"));
const API = "http://localhost:8080";
fs.mkdirSync("shots", { recursive: true });

const pages = {
  public: [
    ["user-home", "http://localhost:3000/"],
    ["user-services", "http://localhost:3000/services"],
    ["user-service-detail", `http://localhost:3000/services/${acc.serviceSlug}`],
    ["user-how-it-works", "http://localhost:3000/how-it-works"],
    ["user-login", "http://localhost:3000/login"],
    ["seller-signup", "http://localhost:3001/signup"],
    ["admin-login", "http://localhost:3002/login"],
  ],
  couple: [
    ["user-bookings", "http://localhost:3000/bookings"],
    ["user-booking-replacement", `http://localhost:3000/bookings/${acc.coupleBookingId}`],
    ["user-booking-released", `http://localhost:3000/bookings/${acc.releasedBookingId}`],
    ["user-profile", "http://localhost:3000/profile"],
    ["user-notifications", "http://localhost:3000/notifications"],
  ],
  provider: [
    ["seller-dashboard", "http://localhost:3001/dashboard"],
    ["seller-services", "http://localhost:3001/services"],
    ["seller-new-service", "http://localhost:3001/services/new"],
    ["seller-bookings", "http://localhost:3001/bookings?"],
    ["seller-booking", `http://localhost:3001/bookings/${acc.providerBookingId}`],
    ["seller-availability", "http://localhost:3001/availability"],
    ["seller-payouts", "http://localhost:3001/payouts"],
    ["seller-penalties", "http://localhost:3001/penalties"],
    ["seller-questions", "http://localhost:3001/questions"],
  ],
  admin: [
    ["admin-dashboard", "http://localhost:3002/dashboard"],
    ["admin-providers", "http://localhost:3002/providers"],
    ["admin-provider", `http://localhost:3002/providers/${acc.providerId}`],
    ["admin-bookings", "http://localhost:3002/bookings"],
    ["admin-booking", `http://localhost:3002/bookings/${acc.releasedBookingId}`],
    ["admin-disputes", "http://localhost:3002/disputes"],
    ["admin-penalties", "http://localhost:3002/penalties"],
    ["admin-payouts", "http://localhost:3002/payouts"],
    ["admin-settings", "http://localhost:3002/settings"],
  ],
};

const login = { couple: ["/auth/api/login-user", acc.couple], provider: ["/auth/api/login-seller", acc.provider], admin: ["/auth/api/login-admin", acc.admin] };

(async () => {
  const browser = await chromium.launch();
  for (const [group, list] of Object.entries(pages)) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    if (login[group]) {
      const [path, creds] = login[group];
      const res = await context.request.post(API + path, { data: creds });
      console.log(group, "login", res.status());
    }
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log(`[${group}] page error:`, e.message));
    page.on("console", (m) => m.type() === "error" && console.log(`[${group}] console:`, m.text().slice(0, 300)));
    for (const [name, url] of list) {
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: `shots/${name}.png`, fullPage: true });
        console.log("shot", name);
      } catch (e) {
        console.log("FAILED", name, e.message);
      }
    }
    if (group === "public") {
      const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
      const mp = await mobile.newPage();
      for (const [name, url] of [["mobile-home", "http://localhost:3000/"], ["mobile-service", `http://localhost:3000/services/${acc.serviceSlug}`]]) {
        await mp.goto(url, { waitUntil: "networkidle" });
        await mp.waitForTimeout(800);
        await mp.screenshot({ path: `shots/${name}.png`, fullPage: true });
      }
      await mobile.close();
    }
    await context.close();
  }
  await browser.close();
})();
