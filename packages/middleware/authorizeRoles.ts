import { ForbiddenError } from "@packages/error-handler";
import { NextFunction, Response } from "express";

// Use after authenticate(...). Each guard now calls next() on success
// (the old versions never did, so protected routes hung).
const requireRole = (role: string, label: string) => (req: any, _res: Response, next: NextFunction) => {
  if (req.role !== role) return next(new ForbiddenError(`Access denied: ${label} only`));
  return next();
};

export const isSeller = requireRole("seller", "service providers");
export const isUser = requireRole("user", "couples");
export const isAdmin = requireRole("admin", "admins");

/** Blocks suspended / banned providers from actions that create new business */
export const isActiveSeller = (req: any, _res: Response, next: NextFunction) => {
  const status = req.seller?.status;
  if (status === "suspended" || status === "banned") {
    return next(new ForbiddenError(`Your account is ${status}. Contact HUZA support.`));
  }
  return next();
};
