import "dotenv/config";
import { createServiceApp, startServiceApp } from "@packages/utils/server";
import { isMockMode } from "@packages/libs/flutterwave";
import router from "./routes/booking.router";
import { startBookingJobs } from "./jobs";

const app = createServiceApp("booking-service");
app.use("/api", router);

startServiceApp(app, "booking-service", Number(process.env.BOOKING_SERVICE_PORT) || 6003);
if (process.env.DISABLE_JOBS !== "true") startBookingJobs();
if (isMockMode) console.warn("[booking-service] FLUTTERWAVE_SECRET_KEY not set — running payments in MOCK mode");
