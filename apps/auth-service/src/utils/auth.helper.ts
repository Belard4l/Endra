import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Response } from "express";
import { ValidationError } from "@packages/error-handler";
import redis from "@packages/libs/redis";
import { sendEmail } from "@packages/libs/email";
import { COOKIE_NAMES, Role } from "@packages/middleware/isAuthenticated";
import { setCookie } from "./cookies/setCookie";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Rwandan phone numbers: 07XXXXXXXX or +2507XXXXXXXX
export const rwPhoneRegex = /^(\+?250|0)?7[2389]\d{7}$/;

export const validateRegistrationData = (data: any, userType: "user" | "seller") => {
  const { name, email, password, phone_number } = data;
  if (!name || !email || !password || (userType === "seller" && !phone_number)) {
    throw new ValidationError("Missing required fields");
  }
  if (!emailRegex.test(email)) throw new ValidationError("Invalid email format");
  if (String(password).length < 8) throw new ValidationError("Password must be at least 8 characters");
  if (userType === "seller" && !rwPhoneRegex.test(String(phone_number).replace(/\s/g, ""))) {
    throw new ValidationError("Enter a valid Rwandan phone number (e.g. 0788123456)");
  }
};

/**
 * OTP rate limits. These THROW (the old version called next() and kept going,
 * so a locked-out user could still receive codes).
 */
export const checkOtpRestrictions = async (email: string) => {
  if (await redis.get(`otp_lock:${email}`)) {
    throw new ValidationError("Too many incorrect OTP attempts. Please try again after 30 minutes.");
  }
  if (await redis.get(`otp_spam_lock:${email}`)) {
    throw new ValidationError("Too many OTP requests. Please try again after 1 hour.");
  }
  if (await redis.get(`otp_cooldown:${email}`)) {
    throw new ValidationError("Please wait 1 minute before requesting another OTP.");
  }
};

export const trackOtpRequests = async (email: string) => {
  const key = `otp_request_count:${email}`;
  const count = parseInt((await redis.get(key)) || "0");
  if (count >= 3) {
    await redis.set(`otp_spam_lock:${email}`, "locked", "EX", 3600);
    throw new ValidationError("Too many OTP requests. Please try again after 1 hour.");
  }
  await redis.set(key, count + 1, "EX", 3600);
};

export const sendOtp = async (name: string, email: string, template: string) => {
  const otp = crypto.randomInt(100000, 999999).toString();
  await redis.set(`otp:${email}`, otp, "EX", 300);
  await redis.set(`otp_cooldown:${email}`, "true", "EX", 60);
  await sendEmail(email, "Your HUZA verification code", template, { name, otp });
};

export const verifyOtp = async (email: string, otp: string) => {
  const storedOtp = await redis.get(`otp:${email}`);
  if (!storedOtp) throw new ValidationError("Invalid or expired OTP. Please request a new one.");

  const attemptsKey = `otp_attempts:${email}`;
  const attempts = parseInt((await redis.get(attemptsKey)) || "0");
  if (storedOtp !== String(otp)) {
    if (attempts >= 2) {
      await redis.set(`otp_lock:${email}`, "locked", "EX", 1800);
      await redis.del(`otp:${email}`, attemptsKey);
      throw new ValidationError("Too many incorrect OTP attempts. Please try again after 30 minutes.");
    }
    await redis.set(attemptsKey, attempts + 1, "EX", 300);
    throw new ValidationError(`Incorrect OTP. ${2 - attempts} attempt(s) left.`);
  }
  await redis.del(`otp:${email}`, attemptsKey);
  // Allows exactly one password reset after a verified forgot-password OTP
  await redis.set(`otp_verified:${email}`, "true", "EX", 600);
};

export const consumeVerifiedOtp = async (email: string) => {
  const ok = await redis.get(`otp_verified:${email}`);
  if (!ok) throw new ValidationError("Please verify the code sent to your email first.");
  await redis.del(`otp_verified:${email}`);
};

export const issueTokens = (res: Response, id: string, role: Role) => {
  const accessToken = jwt.sign({ id, role }, process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ id, role }, process.env.REFRESH_TOKEN_SECRET as string, { expiresIn: "7d" });
  setCookie(res, COOKIE_NAMES[role].access, accessToken);
  setCookie(res, COOKIE_NAMES[role].refresh, refreshToken);
};
