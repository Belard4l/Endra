import { Response } from "express";

const baseOptions = () => ({
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
});

export const setCookie = (res: Response, name: string, value: string, maxAgeMs = 7 * 24 * 60 * 60 * 1000) => {
  res.cookie(name, value, { ...baseOptions(), maxAge: maxAgeMs });
};

export const clearCookie = (res: Response, name: string) => {
  res.clearCookie(name, baseOptions());
};
