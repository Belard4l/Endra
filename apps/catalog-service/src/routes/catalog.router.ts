import express, { Router } from "express";
import { authenticate, optionalRole, optionalUser } from "@packages/middleware/isAuthenticated";
import { ah } from "@packages/utils/server";
import * as pub from "../controllers/public.controller";
import * as rec from "../controllers/recommend.controller";
import * as sel from "../controllers/seller.controller";

const router: Router = express.Router();
const user = authenticate("user");
const seller = authenticate("seller");

// ── Public (couples & visitors) ──
router.get("/categories", ah(pub.listCategories));
router.get("/settings/public", ah(pub.publicSettings));
router.get("/services", ah(pub.listServices));
router.get("/services/:slug", optionalUser, optionalRole("seller"), ah(pub.getService));
router.get("/services/:id/availability", optionalUser, ah(pub.serviceAvailability));
router.post("/services/:id/quote", ah(pub.quoteService));
router.get("/services/:id/questions", ah(pub.listQuestions));
router.post("/services/:id/questions", user, ah(pub.askQuestion));
router.get("/services/:id/reviews", ah(pub.listServiceReviews));
router.get("/services/:id/also-booked", ah(rec.alsoBooked));
router.get("/providers", ah(pub.listProviders));
router.get("/providers/:id", ah(pub.getProvider));
router.get("/recommendations", optionalUser, ah(rec.recommendations));
router.post("/events", optionalUser, ah(pub.trackEvent));

// ── Service providers ──
router.get("/seller/services", seller, ah(sel.myServices));
router.post("/seller/services", seller, ah(sel.createService));
router.get("/seller/services/:id", seller, ah(sel.myService));
router.put("/seller/services/:id", seller, ah(sel.updateService));
router.patch("/seller/services/:id/status", seller, ah(sel.setServiceStatus));
router.delete("/seller/services/:id", seller, ah(sel.deleteService));
router.post("/seller/services/:id/restore", seller, ah(sel.restoreService));
router.get("/seller/availability", seller, ah(sel.getAvailability));
router.put("/seller/availability", seller, ah(sel.updateAvailability));
router.get("/seller/questions", seller, ah(sel.myQuestions));
router.post("/seller/questions/:id/answer", seller, ah(sel.answerQuestion));
router.get("/seller/reviews", seller, ah(sel.myReviews));

export default router;
