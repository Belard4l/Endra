import { Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "@packages/libs/prisma";
import { AuthError, ValidationError } from "@packages/error-handler";
import { uploadFile, deleteFile } from "@packages/libs/imagekit";
import { RWANDA_DISTRICTS } from "@packages/utils/config";
import { isValidDateString } from "@packages/utils/dates";
import {
  checkOtpRestrictions,
  consumeVerifiedOtp,
  issueTokens,
  rwPhoneRegex,
  sendOtp,
  trackOtpRequests,
  validateRegistrationData,
  verifyOtp,
} from "../utils/auth.helper";

const publicUser = (u: any) => {
  if (!u) return u;
  const { password, ...rest } = u;
  return rest;
};

// POST /user-registration  → sends OTP
export const userRegistration = async (req: any, res: Response) => {
  validateRegistrationData(req.body, "user");
  const email = String(req.body.email).toLowerCase().trim();
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) throw new ValidationError("Email already in use.");
  await checkOtpRestrictions(email);
  await trackOtpRequests(email);
  await sendOtp(req.body.name, email, "user-activation-mail");
  res.status(200).json({ message: "OTP sent to email successfully" });
};

// POST /verify-user  → creates the account
export const verifyUser = async (req: any, res: Response) => {
  const { otp, password, name } = req.body;
  const email = String(req.body.email || "").toLowerCase().trim();
  if (!email || !otp || !password || !name) throw new ValidationError("Missing required fields");
  if (await prisma.users.findUnique({ where: { email } })) throw new ValidationError("User already exists.");
  await verifyOtp(email, otp);
  const hashed = await bcrypt.hash(password, 10);
  await prisma.users.create({ data: { name, email, password: hashed } });
  res.status(201).json({ success: true, message: "Account created. You can now log in." });
};

export const loginUser = async (req: any, res: Response) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const { password } = req.body;
  if (!email || !password) throw new ValidationError("Missing required fields");
  const user = await prisma.users.findUnique({ where: { email } });
  if (!user || user.role !== "user") throw new AuthError("Invalid email or password");
  if (!user.password) throw new AuthError("This account has no password set");
  if (user.isBanned) throw new AuthError("This account has been suspended. Contact HUZA support.");
  if (!(await bcrypt.compare(password, user.password))) throw new AuthError("Invalid email or password");
  issueTokens(res, user.id, "user");
  res.status(200).json({ message: "Login successful", user: publicUser(user) });
};

export const getUser = async (req: any, res: Response) => {
  res.status(200).json({ success: true, user: req.user });
};

export const userForgotPassword = async (req: any, res: Response) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  if (!email) throw new ValidationError("Email is required");
  const user = await prisma.users.findUnique({ where: { email } });
  if (!user) throw new ValidationError("No account found with this email");
  await checkOtpRestrictions(email);
  await trackOtpRequests(email);
  await sendOtp(user.name, email, "forgot-password-user-mail");
  res.status(200).json({ message: "OTP sent to your email" });
};

export const verifyUserForgotPassword = async (req: any, res: Response) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  if (!email || !req.body.otp) throw new ValidationError("Email and OTP are required");
  await verifyOtp(email, req.body.otp);
  res.status(200).json({ message: "OTP verified successfully" });
};

export const resetUserPassword = async (req: any, res: Response) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const { newPassword } = req.body;
  if (!email || !newPassword) throw new ValidationError("Email and password are required");
  if (String(newPassword).length < 8) throw new ValidationError("Password must be at least 8 characters");
  const user = await prisma.users.findUnique({ where: { email } });
  if (!user) throw new ValidationError("User not found");
  await consumeVerifiedOtp(email);
  if (user.password && (await bcrypt.compare(newPassword, user.password))) {
    throw new ValidationError("New password must be different from the old password");
  }
  await prisma.users.update({ where: { email }, data: { password: await bcrypt.hash(newPassword, 10) } });
  res.status(200).json({ message: "Password reset successfully" });
};

export const changeUserPassword = async (req: any, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) throw new ValidationError("Both passwords are required");
  if (String(newPassword).length < 8) throw new ValidationError("Password must be at least 8 characters");
  const user = await prisma.users.findUnique({ where: { id: req.user.id } });
  if (!user?.password || !(await bcrypt.compare(currentPassword, user.password))) {
    throw new ValidationError("Current password is incorrect");
  }
  if (await bcrypt.compare(newPassword, user.password)) throw new ValidationError("Choose a new password");
  await prisma.users.update({ where: { id: user.id }, data: { password: await bcrypt.hash(newPassword, 10) } });
  res.json({ success: true, message: "Password updated" });
};

// PUT /user-profile — name, phone, language, wedding details
export const updateUserProfile = async (req: any, res: Response) => {
  const { name, phone, language, weddingDate, weddingDistrict, budget, avatar } = req.body;
  const data: Record<string, unknown> = {};
  if (name !== undefined) {
    if (!String(name).trim()) throw new ValidationError("Name cannot be empty");
    data.name = String(name).trim();
  }
  if (phone !== undefined) {
    if (phone && !rwPhoneRegex.test(String(phone).replace(/\s/g, ""))) throw new ValidationError("Enter a valid Rwandan phone number");
    data.phone = phone || null;
  }
  if (language !== undefined) {
    if (!["en", "rw"].includes(language)) throw new ValidationError("Unsupported language");
    data.language = language;
  }
  if (weddingDate !== undefined) {
    if (weddingDate && !isValidDateString(weddingDate)) throw new ValidationError("Invalid wedding date");
    data.weddingDate = weddingDate || null;
  }
  if (weddingDistrict !== undefined) {
    if (weddingDistrict && !RWANDA_DISTRICTS.includes(weddingDistrict)) throw new ValidationError("Unknown district");
    data.weddingDistrict = weddingDistrict || null;
  }
  if (budget !== undefined) data.budget = budget ? Math.max(0, Math.round(Number(budget))) : null;
  if (avatar) {
    const stored = await uploadFile(avatar, "avatar", "avatars");
    await deleteFile(req.user.avatar?.fileId);
    data.avatar = { fileId: stored.fileId, url: stored.url };
  }
  const user = await prisma.users.update({ where: { id: req.user.id }, data });
  res.json({ success: true, user: publicUser(user) });
};
