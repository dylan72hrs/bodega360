import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuditAction } from "@prisma/client";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { writeAudit } from "../audit/audit.service.js";

export const authRouter = Router();

const loginSchema = z.object({
  identifier: z.string().trim().min(1).optional(),
  email: z.string().trim().min(1).optional(),
  password: z.string().min(1)
});

authRouter.post("/login", async (request, response, next) => {
  try {
    const data = loginSchema.parse(request.body);
    const identifier = data.identifier ?? data.email ?? "";
    const user = await prisma.user.findUnique({ where: { email: identifier } });

    if (!user || !user.active || !(await bcrypt.compare(data.password, user.passwordHash))) {
      response.status(401).json({ message: "Credenciales invalidas." });
      return;
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
      expiresIn: "8h"
    });

    await writeAudit({
      action: AuditAction.LOGIN,
      entity: "User",
      entityId: user.id,
      userId: user.id,
      note: "Inicio de sesion"
    });

    response.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      select: { id: true, name: true, email: true, role: true, active: true }
    });

    response.json({ user });
  } catch (error) {
    next(error);
  }
});
