import "dotenv/config";
import { createServiceApp, startServiceApp } from "@packages/utils/server";
import router from "./routes/admin.router";

const app = createServiceApp("admin-service");
app.use("/api", router);

startServiceApp(app, "admin-service", Number(process.env.ADMIN_SERVICE_PORT) || 6004);
