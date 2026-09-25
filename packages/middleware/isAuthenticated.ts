import prisma from "@packages/libs/prisma";
import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";

export type Role = "user" | "seller" | "admin";

export const COOKIE_NAMES: Record<Role, { access: string; refresh: string }> = {
  user: { access: "access_token", refresh: "refresh_token" },
  seller: { access: "seller-access-token", refresh: "seller-refresh-token" },
  admin: { access: "admin-access-token", refresh: "admin-refresh-token" },
};

type Decoded = { id: string; role: Role };

const loadAccount = async (decoded: Decoded) => {
  if (decoded.role === "seller") {
    return prisma.sellers.findUnique({ where: { id: decoded.id }, include: { shop: true } });
  }
  const user = await prisma.users.findUnique({ where: { id: decoded.id } });
  if (!user) return null;
  if (decoded.role === "admin" && user.role !== "admin") return null;
  return user;
};

const strip = (account: any) => {
  if (!account) return account;
  const { password, ...rest } = account;
  return rest;
};

/**
 * Authenticates the request for one of the given roles.
 * Each role has its own cookie, so a person logged in as a couple and a
 * provider in the same browser never gets the wrong account.
 */
export const authenticate =
  (...roles: Role[]) =>
  async (req: any, res: Response, next: NextFunction) => {
    const allowed: Role[] = roles.length ? roles : ["user", "seller", "admin"];
    try {
      for (const role of allowed) {
        const token =
          req.cookies?.[COOKIE_NAMES[role].access] ||
          (req.headers["x-role"] === role ? req.headers.authorization?.split(" ")[1] : undefined);
        if (!token) continue;
        let decoded: Decoded;
        try {
          decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as Decoded;
        } catch {
          continue;
        }
        if (decoded.role !== role) continue;
        const account = await loadAccount(decoded);
        if (!account) continue;
        if (role === "user" && (account as any).isBanned) {
          return res.status(403).json({ message: "This account has been suspended." });
        }
        if (role === "seller") req.seller = strip(account);
        else if (role === "admin") req.admin = strip(account);
        else req.user = strip(account);
        req.role = role;
        req.accountId = decoded.id;
        return next();
      }
      return res.status(401).json({ message: "Unauthorized: please log in again." });
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized! Token expired or invalid." });
    }
  };

/** Attaches the account for a role when logged in, but never blocks the request */
export const optionalRole =
  (role: Role) =>
  async (req: any, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[COOKIE_NAMES[role].access];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as Decoded;
        if (decoded.role === role) {
          const account = await loadAccount(decoded);
          if (account) {
            if (role === "seller") req.seller = strip(account);
            else if (role === "admin") req.admin = strip(account);
            else req.user = strip(account);
          }
        }
      } catch {
        /* not logged in — fine */
      }
    }
    next();
  };

export const optionalUser = optionalRole("user");

const isAuthenticated = authenticate();
export default isAuthenticated;
