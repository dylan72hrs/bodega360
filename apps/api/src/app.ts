import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { notFound, errorHandler } from "./middleware/errors.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { materialRouter } from "./modules/materials/material.routes.js";
import { importExportRouter } from "./modules/importExport/importExport.routes.js";
import { auditRouter } from "./modules/audit/audit.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { searchLogsRouter } from "./modules/searchLogs/searchLogs.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.WEB_ORIGIN }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", name: "Bodega360 API" });
});

app.use("/api/auth", authRouter);
app.use("/api/materials", materialRouter);
app.use("/api/import", importExportRouter);
app.use("/api/export", importExportRouter);
app.use("/api/audit", auditRouter);
app.use("/api/search-logs", searchLogsRouter);
app.use("/api/users", usersRouter);

app.use(notFound);
app.use(errorHandler);
