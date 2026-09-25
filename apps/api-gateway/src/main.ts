import "dotenv/config";
import express from "express";
import cors from "cors";
import proxy from "express-http-proxy";
import morgan from "morgan";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import cookieParser from "cookie-parser";

const app = express();

const origins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3001,http://localhost:3002")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: origins,
    allowedHeaders: ["Authorization", "Content-Type", "x-role"],
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(cookieParser());
app.set("trust proxy", 1);

// Per-IP limits per 15 minutes. Kept generous because one page makes several
// API calls and many Rwandan mobile users share an IP (carrier NAT).
const VISITOR_LIMIT = Number(process.env.RATE_LIMIT_VISITOR) || 600;
const SESSION_LIMIT = Number(process.env.RATE_LIMIT_SESSION) || 3000;
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: (req: any) =>
    req.cookies?.access_token || req.cookies?.["seller-access-token"] || req.cookies?.["admin-access-token"] ? SESSION_LIMIT : VISITOR_LIMIT,
  message: { message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => ipKeyGenerator(req.ip),
  // Payment provider callbacks must never be rate limited
  skip: (req) => req.path.startsWith("/booking/api/webhooks"),
});
app.use(limiter);

app.get("/gateway-health", (_req, res) => {
  res.send({ message: "HUZA api-gateway is running" });
});

const target = (port: string | undefined, fallback: number) => `http://localhost:${port || fallback}`;
// The body is streamed straight through (no JSON parsing here), which keeps
// large uploads and webhook signatures intact.
const opts = { limit: "30mb", parseReqBody: true } as const;

app.use("/auth", proxy(target(process.env.AUTH_SERVICE_PORT, 6001), opts));
app.use("/catalog", proxy(target(process.env.CATALOG_SERVICE_PORT, 6002), opts));
app.use("/booking", proxy(target(process.env.BOOKING_SERVICE_PORT, 6003), opts));
app.use("/admin", proxy(target(process.env.ADMIN_SERVICE_PORT, 6004), opts));

const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
  console.log(`[api-gateway] listening at http://localhost:${port}`);
  console.log("  /auth → 6001   /catalog → 6002   /booking → 6003   /admin → 6004");
});
server.on("error", console.error);
