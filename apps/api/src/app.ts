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

const configuredOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
const allowedOrigins = new Set([...configuredOrigins, "http://localhost:5173", "http://127.0.0.1:5173"]);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origen no permitido por CORS: ${origin}`));
    }
  })
);
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.get("/health", (_request, response) => {
  response.json({ status: "OK", name: "Bodega360 API" });
});

app.get("/api/health", (_request, response) => {
  response.json({ status: "OK", name: "Bodega360 API" });
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
