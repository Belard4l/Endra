import express, { Router } from "express";
import { authenticate } from "@packages/middleware/isAuthenticated";
import { isActiveSeller } from "@packages/middleware/authorizeRoles";
import { ah } from "@packages/utils/server";
import * as co from "../controllers/checkout.controller";
import * as cp from "../controllers/couple.controller";
import * as pr from "../controllers/provider.controller";
import * as cm from "../controllers/common.controller";

const router: Router = express.Router();
const user = authenticate("user");
const seller = authenticate("seller");
const admin = authenticate("admin");

// ── Payments ──
router.post("/checkout", user, ah(co.checkout));
router.get("/payments/verify", user, ah(co.verifyPayment));
router.post("/payments/mock-complete", user, ah(co.mockComplete));
router.post("/webhooks/flutterwave", ah(co.flutterwaveWebhook));

// ── Couples ──
router.get("/my-bookings", user, ah(cp.myBookings));
router.get("/bookings/:id", user, ah(cp.bookingDetail));
router.post("/bookings/:id/pay-balance", user, ah(co.payBalance));
router.get("/bookings/:id/cancel-quote", user, ah(cp.cancelQuote));
router.post("/bookings/:id/cancel", user, ah(cp.cancelBooking));
router.post("/bookings/:id/reschedule", user, ah(cp.reschedule));
router.post("/bookings/:id/choose-refund", user, ah(cp.refundChoice));
router.post("/bookings/:id/choose-replacement", user, ah(cp.replacementChoice));
router.post("/bookings/:id/confirm-delivery", user, ah(cp.confirm));
router.post("/bookings/:id/dispute", user, ah(cp.dispute));
router.post("/bookings/:id/review", user, ah(cp.review));
router.get("/bookings/:id/messages", user, ah(cm.listMessages("user")));
router.post("/bookings/:id/messages", user, ah(cm.sendMessage("user")));
router.get("/notifications", user, ah(cm.listNotifications("user")));
router.patch("/notifications/:id/read", user, ah(cm.markRead("user")));
router.post("/notifications/read-all", user, ah(cm.markAllRead("user")));

// ── Service providers ──
router.get("/seller/dashboard", seller, ah(pr.dashboard));
router.get("/seller/bookings", seller, ah(pr.listBookings));
router.get("/seller/bookings/:id", seller, ah(pr.bookingDetail));
router.post("/seller/bookings/:id/cancel", seller, ah(pr.cancel));
router.post("/seller/bookings/:id/complete", seller, isActiveSeller, ah(pr.complete));
router.post("/seller/bookings/:id/dispute-response", seller, ah(pr.respondToDispute));
router.get("/seller/bookings/:id/messages", seller, ah(cm.listMessages("seller")));
router.post("/seller/bookings/:id/messages", seller, ah(cm.sendMessage("seller")));
router.get("/seller/payouts", seller, ah(pr.payouts));
router.get("/seller/penalties", seller, ah(pr.penalties));
router.post("/seller/penalties/:id/appeal", seller, ah(pr.appeal));
router.get("/seller/notifications", seller, ah(cm.listNotifications("seller")));
router.patch("/seller/notifications/:id/read", seller, ah(cm.markRead("seller")));
router.post("/seller/notifications/read-all", seller, ah(cm.markAllRead("seller")));

// ── Admin notifications ──
router.get("/admin/notifications", admin, ah(cm.listNotifications("admin")));
router.patch("/admin/notifications/:id/read", admin, ah(cm.markRead("admin")));
router.post("/admin/notifications/read-all", admin, ah(cm.markAllRead("admin")));

export default router;
