import { Router } from "express";
import multer from "multer";
import readXlsxFile from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import type { Cell, SheetData } from "write-excel-file";
import { AuditAction, Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { writeAudit } from "../audit/audit.service.js";
import { materialInputSchema } from "../materials/material.schemas.js";
import { materialToJson } from "../materials/material.utils.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

export const importExportRouter = Router();

importExportRouter.use(requireAuth);

const excelHeaders: Record<string, string> = {
  codigo: "code",
  "codigo alternativo": "alternateCode",
  nombre: "name",
  descripcion: "description",
  categoria: "category",
  marca: "brand",
  modelo: "model",
  unidad: "unit",
  stock: "stock",
  "costo promedio": "averageCost",
  moneda: "currency",
  ubicacion: "location",
  estado: "status",
  validado: "validated"
};

function normalizeRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      const normalizedKey = key.trim().toLowerCase();
      return [excelHeaders[normalizedKey] ?? key, value];
    })
  );
}

importExportRouter.post("/materials", requireRole(Role.ADMIN, Role.WAREHOUSE), upload.single("file"), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ message: "Debe adjuntar un archivo Excel." });
      return;
    }

    const excelRows = await readXlsxFile(request.file.buffer);

    if (!excelRows.length) {
      response.status(400).json({ message: "El archivo Excel no contiene hojas." });
      return;
    }

    const headers = excelRows[0].map((header) => String(header ?? "").trim());
    const rows: Record<string, unknown>[] = [];

    for (const row of excelRows.slice(1)) {
      const item: Record<string, unknown> = {};
      headers.forEach((header, columnNumber) => {
        if (!header) return;
        item[header] = row[columnNumber] ?? "";
      });
      rows.push(item);
    }

    let created = 0;
    let updated = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (const [index, rawRow] of rows.entries()) {
      const parsed = materialInputSchema.safeParse(normalizeRow(rawRow));

      if (!parsed.success) {
        errors.push({ row: index + 2, message: parsed.error.issues.map((issue) => issue.message).join(", ") });
        continue;
      }

      const existing = await prisma.material.findUnique({ where: { code: parsed.data.code } });
      await prisma.material.upsert({
        where: { code: parsed.data.code },
        create: parsed.data,
        update: parsed.data
      });

      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }
    }

    await writeAudit({
      action: AuditAction.IMPORT,
      entity: "Material",
      userId: request.user!.id,
      note: `Importacion Excel: ${created} creados, ${updated} actualizados, ${errors.length} errores`
    });

    response.json({ created, updated, errors });
  } catch (error) {
    next(error);
  }
});

importExportRouter.get("/materials.xlsx", requireRole(Role.ADMIN, Role.WAREHOUSE), async (request, response, next) => {
  try {
    const materials = await prisma.material.findMany({ orderBy: { name: "asc" } });
    const rows: Record<string, unknown>[] = materials.map((material) => {
      const item = materialToJson(material);
      return {
        codigo: item.code,
        "codigo alternativo": item.alternateCode,
        nombre: item.name,
        descripcion: item.description,
        categoria: item.category,
        marca: item.brand,
        modelo: item.model,
        unidad: item.unit,
        stock: item.stock,
        "costo promedio": item.averageCost,
        moneda: item.currency,
        ubicacion: item.location,
        estado: item.status,
        foto: item.mainPhotoPath,
        validado: item.validated ? "SI" : "NO",
        incompleto: item.incomplete ? "SI" : "NO",
        "ultima actualizacion": item.lastUpdatedAt
      };
    });

    const headers = Object.keys(rows[0] ?? { codigo: "" });
    const sheet: SheetData = [
      headers.map((header) => ({ value: header, type: String, fontWeight: "bold" })),
      ...rows.map((row) => headers.map((header) => toExcelCell(row[header])))
    ];
    const buffer = await writeXlsxFile(sheet, {
      buffer: true,
      sheet: "materiales",
      columns: headers.map((header) => ({ width: Math.max(14, header.length + 2) }))
    });

    await writeAudit({
      action: AuditAction.EXPORT,
      entity: "Material",
      userId: request.user!.id,
      note: "Exportacion respaldo Excel"
    });

    response.setHeader("Content-Disposition", "attachment; filename=bodega360-materiales.xlsx");
    response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.send(buffer);
  } catch (error) {
    next(error);
  }
});

function toExcelCell(value: unknown): Cell {
  if (typeof value === "number") return { value, type: Number };
  if (typeof value === "boolean") return { value, type: Boolean };
  if (value instanceof Date) return { value, type: Date, format: "dd/mm/yyyy" };
  return { value: value === null || value === undefined ? "" : String(value), type: String };
}
