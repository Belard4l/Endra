import "dotenv/config";
import { createServiceApp, startServiceApp } from "@packages/utils/server";
import router from "./routes/auth.router";

const app = createServiceApp("auth-service");
app.use("/api", router);

startServiceApp(app, "auth-service", Number(process.env.AUTH_SERVICE_PORT) || 6001);
