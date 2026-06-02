import { Router } from "express";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole(Role.ADMIN));

const userInputSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role)
});

usersRouter.get("/", async (_request, response, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true }
    });
    response.json({ users });
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/", async (request, response, next) => {
  try {
    const data = userInputSchema.parse(request.body);
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role
      },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true }
    });

    response.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});
