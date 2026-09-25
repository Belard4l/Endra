import express, { Router } from "express";
import { authenticate } from "@packages/middleware/isAuthenticated";
import { ah } from "@packages/utils/server";
import * as u from "../controller/user.controller";
import * as s from "../controller/seller.controller";
import * as session from "../controller/session.controller";

const router: Router = express.Router();
const user = authenticate("user");
const seller = authenticate("seller");
const admin = authenticate("admin");

// ── Couples ──
router.post("/user-registration", ah(u.userRegistration));
router.post("/verify-user", ah(u.verifyUser));
router.post("/login-user", ah(u.loginUser));
router.post("/refresh-token-user", ah(session.refreshFor("user")));
router.post("/logout-user", ah(session.logoutFor("user")));
router.get("/logged-in-user", user, ah(u.getUser));
router.post("/forgot-password-user", ah(u.userForgotPassword));
router.post("/verify-forgot-password-user", ah(u.verifyUserForgotPassword));
router.post("/reset-password-user", ah(u.resetUserPassword));
router.post("/change-password-user", user, ah(u.changeUserPassword));
router.put("/user-profile", user, ah(u.updateUserProfile));

// ── Service providers ──
router.post("/seller-registration", ah(s.registerSeller));
router.post("/verify-seller", ah(s.verifySeller));
router.post("/login-seller", ah(s.loginSeller));
router.post("/refresh-token-seller", ah(session.refreshFor("seller")));
router.post("/logout-seller", ah(session.logoutFor("seller")));
router.get("/logged-in-seller", seller, ah(s.getSeller));
router.post("/create-shop", seller, ah(s.createShop));
router.post("/save-seller-payment", seller, ah(s.saveSellerPayment));
router.post("/seller-verification", seller, ah(s.submitVerification));
router.get("/banks", ah(s.listBanks));
router.put("/seller-profile", seller, ah(s.updateSellerProfile));
router.post("/forgot-password-seller", ah(s.sellerForgotPassword));
router.post("/verify-forgot-password-seller", ah(s.verifySellerForgotPassword));
router.post("/reset-password-seller", ah(s.resetSellerPassword));
router.post("/change-password-seller", seller, ah(s.changeSellerPassword));

// ── Admins ──
router.post("/login-admin", ah(session.loginAdmin));
router.post("/refresh-token-admin", ah(session.refreshFor("admin")));
router.post("/logout-admin", ah(session.logoutFor("admin")));
router.get("/logged-in-admin", admin, ah(session.getAdmin));

export default router;
