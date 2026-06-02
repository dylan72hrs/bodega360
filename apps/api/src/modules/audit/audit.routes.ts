import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const auditRouter = Router();

auditRouter.use(requireAuth, requireRole(Role.ADMIN, Role.WAREHOUSE));

auditRouter.get("/", async (_request, response, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 200
    });

    response.json({ logs });
  } catch (error) {
    next(error);
  }
});
