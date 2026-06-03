import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function notFound(_request: Request, response: Response) {
  response.status(404).json({ message: "Recurso no encontrado." });
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    response.status(400).json({ message: "Datos invalidos.", issues: error.issues });
    return;
  }

  if (isPrismaConnectionError(error)) {
    response.status(503).json({
      message: "No fue posible conectar con PostgreSQL. Revisa DATABASE_URL y que la base de datos este disponible."
    });
    return;
  }

  console.error(error);
  response.status(500).json({ message: "Error interno del servidor." });
}

function isPrismaConnectionError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "P1000" || candidate.code === "P1001" || candidate.message?.includes("Can't reach database server");
}
