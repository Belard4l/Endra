import "dotenv/config";
import { createServiceApp, startServiceApp } from "@packages/utils/server";
import router from "./routes/catalog.router";
import { startCatalogJobs } from "./jobs";

const app = createServiceApp("catalog-service");
app.use("/api", router);

startServiceApp(app, "catalog-service", Number(process.env.CATALOG_SERVICE_PORT) || 6002);
startCatalogJobs();
