import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const searchLogsRouter = Router();

searchLogsRouter.use(requireAuth, requireRole(Role.ADMIN, Role.WAREHOUSE));

searchLogsRouter.get("/", async (_request, response, next) => {
  try {
    const logs = await prisma.searchLog.findMany({
      include: { user: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 300
    });

    response.json({ logs });
  } catch (error) {
    next(error);
  }
});
