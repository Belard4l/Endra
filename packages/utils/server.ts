import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorMiddleware } from "@packages/error-handler/error-middleware";

/** Allowed browser origins: the three HUZA frontends (override with CORS_ORIGINS) */
export const allowedOrigins = (): string[] =>
  (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3001,http://localhost:3002")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

export const createServiceApp = (serviceName: string) => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin: allowedOrigins(),
      allowedHeaders: ["Authorization", "Content-Type", "x-role"],
      credentials: true,
    })
  );
  // Raw body is kept for webhook signature checks
  app.use(
    express.json({
      limit: "25mb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));
  app.use(cookieParser());
  app.get("/", (_req, res) => {
    res.json({ service: serviceName, status: "ok" });
  });
  return app;
};

export const startServiceApp = (app: express.Express, serviceName: string, port: number) => {
  app.use((_req, res) => {
    res.status(404).json({ message: "Route not found" });
  });
  app.use(errorMiddleware);
  const server = app.listen(port, () => {
    console.log(`[${serviceName}] listening at http://localhost:${port}/api`);
  });
  server.on("error", (err) => console.error(`[${serviceName}] server error`, err));
  return server;
};

/** Wraps an async route so thrown errors reach the error middleware */
export const ah =
  (fn: (req: any, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };

export const toInt = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

export const pageParams = (query: any, defaultLimit = 20) => {
  const page = Math.max(1, toInt(query.page, 1));
  const limit = Math.min(100, Math.max(1, toInt(query.limit, defaultLimit)));
  return { page, limit, skip: (page - 1) * limit };
};
