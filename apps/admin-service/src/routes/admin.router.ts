import express, { Router } from "express";
import { authenticate } from "@packages/middleware/isAuthenticated";
import { ah } from "@packages/utils/server";
import * as a from "../controllers/admin.controller";

const router: Router = express.Router();
// Every admin route requires an admin session
router.use(authenticate("admin"));

router.get("/dashboard", ah(a.dashboard));

router.get("/providers", ah(a.listProviders));
router.get("/providers/export", ah(a.exportProviders));
router.get("/providers/:id", ah(a.providerDetail));
router.post("/providers/:id/verify", ah(a.verifyProvider));
router.post("/providers/:id/status", ah(a.setProviderStatus));

router.get("/users", ah(a.listUsers));
router.get("/users/export", ah(a.exportUsers));
router.post("/users/:id/ban", ah(a.setUserBan));
router.post("/users/:id/role", ah(a.setUserRole));
router.post("/admins", ah(a.createAdmin));

router.get("/bookings", ah(a.listBookings));
router.get("/bookings/export", ah(a.exportBookings));
router.get("/bookings/:id", ah(a.bookingDetail));

router.get("/disputes", ah(a.listDisputes));
router.post("/disputes/:id/decide", ah(a.decideDispute));

router.get("/penalties", ah(a.listPenalties));
router.post("/penalties/:id/decide", ah(a.decidePenalty));

router.get("/payouts", ah(a.listPayouts));
router.post("/payouts/run", ah(a.runPayoutsNow));
router.post("/payouts/:id/retry", ah(a.retry));

router.get("/categories", ah(a.listCategories));
router.post("/categories", ah(a.saveCategory));
router.put("/categories/:id", ah(a.saveCategory));
router.delete("/categories/:id", ah(a.deleteCategory));

router.get("/settings", ah(a.getSiteSettings));
router.put("/settings", ah(a.updateSiteSettings));

router.get("/questions", ah(a.listQuestions));
router.patch("/questions/:id", ah(a.setQuestionHidden));

export default router;
