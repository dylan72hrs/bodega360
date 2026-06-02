import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import multer from "multer";
import { AuditAction, Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { writeAudit } from "../audit/audit.service.js";
import { materialInputSchema, materialUpdateSchema } from "./material.schemas.js";
import { isIncomplete, materialToJson } from "./material.utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadRoot = path.resolve(__dirname, "../../../uploads/materials");

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, uploadRoot),
  filename: (_request, file, callback) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("Solo se permiten imagenes."));
      return;
    }
    callback(null, true);
  }
});

export const materialRouter = Router();

materialRouter.use(requireAuth);

materialRouter.get("/", async (request, response, next) => {
  try {
    const search = String(request.query.search ?? "").trim();
    const requesterName = String(request.query.requesterName ?? "").trim() || null;
    const requesterRut = String(request.query.requesterRut ?? "").trim() || null;
    const incomplete = request.query.incomplete === "true";
    const trackSearch = request.query.track !== "false";

    const where: Prisma.MaterialWhereInput = search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { alternateCode: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { category: { contains: search, mode: "insensitive" } },
            { location: { contains: search, mode: "insensitive" } }
          ]
        }
      : {};

    const materials = await prisma.material.findMany({
      where,
      orderBy: [{ validated: "asc" }, { name: "asc" }],
      take: 100
    });

    const mapped = materials.map(materialToJson).filter((material) => (incomplete ? material.incomplete : true));

    if (search && !incomplete && trackSearch) {
      await prisma.searchLog.create({
        data: {
          query: search,
          requesterName,
          requesterRut,
          resultCount: mapped.length,
          hasResults: mapped.length > 0,
          userId: request.user?.id,
          ipAddress: request.ip
        }
      });
    }

    response.json({ materials: mapped });
  } catch (error) {
    next(error);
  }
});

materialRouter.get("/:id", async (request, response, next) => {
  try {
    const id = String(request.params.id);
    const material = await prisma.material.findUnique({ where: { id } });

    if (!material) {
      response.status(404).json({ message: "Material no encontrado." });
      return;
    }

    response.json({ material: materialToJson(material) });
  } catch (error) {
    next(error);
  }
});

materialRouter.post("/", requireRole(Role.ADMIN, Role.WAREHOUSE), async (request, response, next) => {
  try {
    const data = materialInputSchema.parse(request.body);
    const material = await prisma.material.create({ data });

    await writeAudit({
      action: AuditAction.CREATE,
      entity: "Material",
      entityId: material.id,
      materialId: material.id,
      userId: request.user!.id,
      after: materialToJson(material)
    });

    response.status(201).json({ material: materialToJson(material) });
  } catch (error) {
    next(error);
  }
});

materialRouter.put("/:id", requireRole(Role.ADMIN, Role.WAREHOUSE), async (request, response, next) => {
  try {
    const id = String(request.params.id);
    const data = materialUpdateSchema.parse(request.body);
    const before = await prisma.material.findUnique({ where: { id } });

    if (!before) {
      response.status(404).json({ message: "Material no encontrado." });
      return;
    }

    const material = await prisma.material.update({
      where: { id },
      data
    });

    await writeAudit({
      action: AuditAction.UPDATE,
      entity: "Material",
      entityId: material.id,
      materialId: material.id,
      userId: request.user!.id,
      before: materialToJson(before),
      after: materialToJson(material)
    });

    response.json({ material: materialToJson(material) });
  } catch (error) {
    next(error);
  }
});

materialRouter.post("/:id/photo", requireRole(Role.ADMIN, Role.WAREHOUSE), upload.single("photo"), async (request, response, next) => {
  try {
    const id = String(request.params.id);
    const before = await prisma.material.findUnique({ where: { id } });

    if (!before) {
      response.status(404).json({ message: "Material no encontrado." });
      return;
    }

    if (!request.file) {
      response.status(400).json({ message: "Debe adjuntar una foto." });
      return;
    }

    const relativePath = `/uploads/materials/${request.file.filename}`;
    const material = await prisma.material.update({
      where: { id },
      data: { mainPhotoPath: relativePath }
    });

    await writeAudit({
      action: AuditAction.PHOTO_UPLOAD,
      entity: "Material",
      entityId: material.id,
      materialId: material.id,
      userId: request.user!.id,
      before: materialToJson(before),
      after: materialToJson(material),
      note: "Foto principal actualizada"
    });

    response.json({ material: materialToJson(material) });
  } catch (error) {
    next(error);
  }
});

materialRouter.post("/:id/report-error", async (request, response, next) => {
  try {
    const id = String(request.params.id);
    const material = await prisma.material.findUnique({ where: { id } });

    if (!material) {
      response.status(404).json({ message: "Material no encontrado." });
      return;
    }

    await writeAudit({
      action: AuditAction.ERROR_REPORT,
      entity: "Material",
      entityId: material.id,
      materialId: material.id,
      userId: request.user!.id,
      note: String(request.body?.note ?? "Usuario reporto un error en la ficha.")
    });

    response.status(201).json({ message: "Reporte recibido." });
  } catch (error) {
    next(error);
  }
});
