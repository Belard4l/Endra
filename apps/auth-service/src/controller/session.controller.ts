import { Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "@packages/libs/prisma";
import { AuthError, ValidationError } from "@packages/error-handler";
import { COOKIE_NAMES, Role } from "@packages/middleware/isAuthenticated";
import { clearCookie, setCookie } from "../utils/cookies/setCookie";
import { issueTokens } from "../utils/auth.helper";

/**
 * POST /refresh-token-{user|seller|admin}
 * Issues a new access token from the role's refresh cookie. Errors are now
 * passed to the error handler (the old version returned them instead, so the
 * request hung).
 */
export const refreshFor = (role: Role) => async (req: any, res: Response) => {
  const token = req.cookies?.[COOKIE_NAMES[role].refresh];
  if (!token) throw new AuthError("Unauthorized: no refresh token");
  let decoded: { id: string; role: Role };
  try {
    decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET as string) as { id: string; role: Role };
  } catch {
    throw new AuthError("Session expired. Please log in again.");
  }
  if (decoded.role !== role) throw new AuthError("Invalid session");

  const exists =
    role === "seller"
      ? await prisma.sellers.findUnique({ where: { id: decoded.id } })
      : await prisma.users.findUnique({ where: { id: decoded.id } });
  if (!exists) throw new AuthError("Account not found");

  const access = jwt.sign({ id: decoded.id, role }, process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: "15m" });
  setCookie(res, COOKIE_NAMES[role].access, access);
  res.status(200).json({ success: true });
};

export const logoutFor = (role: Role) => async (_req: any, res: Response) => {
  clearCookie(res, COOKIE_NAMES[role].access);
  clearCookie(res, COOKIE_NAMES[role].refresh);
  res.json({ success: true });
};

// ───────── Admin ─────────

export const loginAdmin = async (req: any, res: Response) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const { password } = req.body;
  if (!email || !password) throw new ValidationError("Email and password are required");
  const user = await prisma.users.findUnique({ where: { email } });
  if (!user || user.role !== "admin" || !user.password || !(await bcrypt.compare(password, user.password))) {
    throw new AuthError("Invalid admin credentials");
  }
  issueTokens(res, user.id, "admin");
  const { password: _p, ...admin } = user;
  res.json({ message: "Login successful", admin });
};

export const getAdmin = async (req: any, res: Response) => {
  res.json({ success: true, admin: req.admin });
};
