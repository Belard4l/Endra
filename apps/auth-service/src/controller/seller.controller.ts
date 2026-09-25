import { Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "@packages/libs/prisma";
import { AuthError, ValidationError } from "@packages/error-handler";
import { deleteFile, uploadFile } from "@packages/libs/imagekit";
import { getRwandaBanks } from "@packages/libs/flutterwave";
import { notifyAdmins } from "@packages/libs/notify";
import { RWANDA_DISTRICTS } from "@packages/utils/config";
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

const PUBLIC_OMIT = ["password", "nationalIdNumber"];
export const publicSeller = (s: any) => {
  if (!s) return s;
  const copy = { ...s };
  PUBLIC_OMIT.forEach((k) => delete copy[k]);
  if (copy.nationalIdDoc) copy.nationalIdDoc = { name: copy.nationalIdDoc.name, uploaded: true };
  if (copy.rdbCertificateDoc) copy.rdbCertificateDoc = { name: copy.rdbCertificateDoc.name, uploaded: true };
  return copy;
};

// Step 1a — send OTP
export const registerSeller = async (req: any, res: Response) => {
  validateRegistrationData(req.body, "seller");
  const email = String(req.body.email).toLowerCase().trim();
  if (await prisma.sellers.findUnique({ where: { email } })) {
    throw new ValidationError("A provider account with this email already exists.");
  }
  await checkOtpRestrictions(email);
  await trackOtpRequests(email);
  await sendOtp(req.body.name, email, "seller-activation");
  res.status(200).json({ message: "OTP sent to email successfully" });
};

// Step 1b — verify OTP, create account and log in (so the next steps are authenticated)
export const verifySeller = async (req: any, res: Response) => {
  const { otp, password, name, phone_number, accountType } = req.body;
  const email = String(req.body.email || "").toLowerCase().trim();
  if (!email || !otp || !password || !name || !phone_number) throw new ValidationError("Missing required fields");
  if (await prisma.sellers.findUnique({ where: { email } })) {
    throw new ValidationError("A provider account with this email already exists.");
  }
  await verifyOtp(email, otp);
  const seller = await prisma.sellers.create({
    data: {
      name,
      email,
      password: await bcrypt.hash(password, 10),
      phone_number: String(phone_number).replace(/\s/g, ""),
      country: "RW",
      accountType: accountType === "company" ? "company" : "individual",
    },
  });
  issueTokens(res, seller.id, "seller");
  res.status(201).json({ seller: publicSeller(seller), message: "Account created" });
};

// Step 2 — business profile
export const createShop = async (req: any, res: Response) => {
  const sellerId = req.seller.id;
  const { name, bio, address, district, openHours, website, category } = req.body;
  if (!name || !bio || !address || !district || !category) throw new ValidationError("Missing required fields");
  if (!RWANDA_DISTRICTS.includes(district)) throw new ValidationError("Choose a valid district");
  if (String(bio).trim().split(/\s+/).length > 100) throw new ValidationError("Bio must be 100 words or fewer");
  const cat = await prisma.categories.findUnique({ where: { slug: category } });
  if (!cat) throw new ValidationError("Choose a valid category");

  const data = {
    name,
    bio,
    address,
    district,
    category,
    openHours: openHours || null,
    website: website?.trim() || null,
  };
  const existing = await prisma.shops.findUnique({ where: { sellerId } });
  const shop = existing
    ? await prisma.shops.update({ where: { sellerId }, data })
    : await prisma.shops.create({ data: { ...data, sellerId, socialLinks: [] } });
  res.status(201).json({ success: true, shop });
};

// Step 3 — payout method (MoMo or bank)
export const saveSellerPayment = async (req: any, res: Response) => {
  const { type } = req.body;
  const updates: Record<string, any> = { paymentMethod: type };
  if (type === "momo") {
    const { phone_number, name, network, momo_code } = req.body;
    if (!phone_number || !name) throw new ValidationError("MoMo number and account name are required");
    const phone = String(phone_number).replace(/\s/g, "");
    if (!rwPhoneRegex.test(phone)) throw new ValidationError("Enter a valid Rwandan MoMo number");
    Object.assign(updates, {
      momoPhoneNumber: phone,
      momoName: name,
      momoNetwork: network === "AIRTEL" ? "AIRTEL" : "MTN",
      momoCode: momo_code || null,
      bankName: null,
      bankCode: null,
      bankAccountNumber: null,
      bankAccountName: null,
    });
  } else if (type === "bank") {
    const { bank_name, bank_code, account_number, account_name } = req.body;
    if (!bank_code || !account_number || !account_name) throw new ValidationError("Bank account details are required");
    if (!/^[0-9]{4,32}$/.test(String(account_number))) throw new ValidationError("Invalid account number format");
    Object.assign(updates, {
      bankName: bank_name || bank_code,
      bankCode: String(bank_code),
      bankAccountNumber: String(account_number),
      bankAccountName: account_name,
      momoPhoneNumber: null,
      momoName: null,
      momoNetwork: null,
      momoCode: null,
    });
  } else {
    throw new ValidationError("Choose MoMo or bank");
  }
  const seller = await prisma.sellers.update({ where: { id: req.seller.id }, data: updates });
  res.status(200).json({ success: true, seller: publicSeller(seller) });
};

export const listBanks = async (_req: any, res: Response) => {
  res.json({ banks: await getRwandaBanks() });
};

// Step 4 — verification documents (6-B: national ID for everyone, RDB certificate for companies)
export const submitVerification = async (req: any, res: Response) => {
  const seller = await prisma.sellers.findUnique({ where: { id: req.seller.id } });
  if (!seller) throw new AuthError("Account not found");
  if (seller.verificationStatus === "approved") throw new ValidationError("Your account is already verified");
  const { nationalIdNumber, nationalIdDoc, rdbNumber, rdbCertificateDoc } = req.body;

  if (!nationalIdNumber || !/^\d{16}$/.test(String(nationalIdNumber).replace(/\s/g, ""))) {
    throw new ValidationError("Enter your 16-digit national ID number");
  }
  if (!nationalIdDoc && !seller.nationalIdDoc) throw new ValidationError("Upload a photo or scan of your national ID");
  if (seller.accountType === "company") {
    if (!rdbNumber) throw new ValidationError("Enter your RDB company code");
    if (!rdbCertificateDoc && !seller.rdbCertificateDoc) throw new ValidationError("Upload your RDB registration certificate");
  }

  const data: Record<string, any> = {
    nationalIdNumber: String(nationalIdNumber).replace(/\s/g, ""),
    rdbNumber: rdbNumber || null,
    verificationStatus: "pending",
    verificationNote: null,
  };
  if (nationalIdDoc) {
    const f = await uploadFile(nationalIdDoc, `national-id-${seller.id}`, "verification", true);
    await deleteFile(seller.nationalIdDoc?.fileId);
    data.nationalIdDoc = f;
  }
  if (rdbCertificateDoc) {
    const f = await uploadFile(rdbCertificateDoc, `rdb-${seller.id}`, "verification", true);
    await deleteFile(seller.rdbCertificateDoc?.fileId);
    data.rdbCertificateDoc = f;
  }
  const updated = await prisma.sellers.update({ where: { id: seller.id }, data });
  await notifyAdmins("Provider verification requested", `${seller.name} submitted verification documents.`, `/providers/${seller.id}`);
  res.json({ success: true, seller: publicSeller(updated) });
};

export const loginSeller = async (req: any, res: Response) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const { password } = req.body;
  if (!email || !password) throw new ValidationError("Email and password are required");
  const seller = await prisma.sellers.findUnique({ where: { email } });
  if (!seller || !(await bcrypt.compare(password, seller.password))) {
    throw new AuthError("Invalid email or password");
  }
  if (seller.status === "banned") throw new AuthError("This provider account has been banned.");
  issueTokens(res, seller.id, "seller");
  res.status(200).json({ message: "Login successful", seller: publicSeller(seller) });
};

export const getSeller = async (req: any, res: Response) => {
  res.status(200).json({ success: true, seller: publicSeller(req.seller) });
};

export const sellerForgotPassword = async (req: any, res: Response) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  if (!email) throw new ValidationError("Email is required");
  const seller = await prisma.sellers.findUnique({ where: { email } });
  if (!seller) throw new ValidationError("No provider account found with this email");
  await checkOtpRestrictions(email);
  await trackOtpRequests(email);
  await sendOtp(seller.name, email, "forgot-password-seller-mail");
  res.status(200).json({ message: "OTP sent to your email" });
};

export const verifySellerForgotPassword = async (req: any, res: Response) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  if (!email || !req.body.otp) throw new ValidationError("Email and OTP are required");
  await verifyOtp(email, req.body.otp);
  res.status(200).json({ message: "OTP verified successfully" });
};

export const resetSellerPassword = async (req: any, res: Response) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const { newPassword } = req.body;
  if (!email || !newPassword) throw new ValidationError("Email and password are required");
  if (String(newPassword).length < 8) throw new ValidationError("Password must be at least 8 characters");
  const seller = await prisma.sellers.findUnique({ where: { email } });
  if (!seller) throw new ValidationError("Account not found");
  await consumeVerifiedOtp(email);
  if (await bcrypt.compare(newPassword, seller.password)) throw new ValidationError("Choose a new password");
  await prisma.sellers.update({ where: { email }, data: { password: await bcrypt.hash(newPassword, 10) } });
  res.status(200).json({ message: "Password reset successfully" });
};

export const changeSellerPassword = async (req: any, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) throw new ValidationError("Both passwords are required");
  if (String(newPassword).length < 8) throw new ValidationError("Password must be at least 8 characters");
  const seller = await prisma.sellers.findUnique({ where: { id: req.seller.id } });
  if (!seller || !(await bcrypt.compare(currentPassword, seller.password))) {
    throw new ValidationError("Current password is incorrect");
  }
  await prisma.sellers.update({ where: { id: seller.id }, data: { password: await bcrypt.hash(newPassword, 10) } });
  res.json({ success: true, message: "Password updated" });
};

// PUT /seller-profile — business profile edits (avatar, cover, bio, links, capacity…)
export const updateSellerProfile = async (req: any, res: Response) => {
  const shop = await prisma.shops.findUnique({ where: { sellerId: req.seller.id } });
  if (!shop) throw new ValidationError("Create your business profile first");
  const { name, bio, address, district, openHours, website, socialLinks, avatar, coverBanner, phone_number } = req.body;
  const data: Record<string, any> = {};
  if (name !== undefined) data.name = String(name).trim() || shop.name;
  if (bio !== undefined) {
    if (String(bio).trim().split(/\s+/).length > 100) throw new ValidationError("Bio must be 100 words or fewer");
    data.bio = bio;
  }
  if (address !== undefined) data.address = address;
  if (district !== undefined) {
    if (!RWANDA_DISTRICTS.includes(district)) throw new ValidationError("Choose a valid district");
    data.district = district;
  }
  if (openHours !== undefined) data.openHours = openHours;
  if (website !== undefined) data.website = website || null;
  if (Array.isArray(socialLinks)) {
    data.socialLinks = socialLinks
      .filter((l: any) => l && typeof l.url === "string" && /^https?:\/\//.test(l.url))
      .slice(0, 6)
      .map((l: any) => ({ platform: String(l.platform || "link").slice(0, 30), url: l.url }));
  }
  if (avatar) {
    const f = await uploadFile(avatar, `avatar-${shop.id}`, "shops");
    await deleteFile(shop.avatar?.fileId);
    data.avatar = { fileId: f.fileId, url: f.url };
  }
  if (coverBanner) {
    const f = await uploadFile(coverBanner, `cover-${shop.id}`, "shops");
    await deleteFile(shop.coverBanner?.fileId);
    data.coverBanner = { fileId: f.fileId, url: f.url };
  }
  const updated = await prisma.shops.update({ where: { id: shop.id }, data });
  if (phone_number) {
    const phone = String(phone_number).replace(/\s/g, "");
    if (!rwPhoneRegex.test(phone)) throw new ValidationError("Enter a valid Rwandan phone number");
    await prisma.sellers.update({ where: { id: req.seller.id }, data: { phone_number: phone } });
  }
  res.json({ success: true, shop: updated });
};
