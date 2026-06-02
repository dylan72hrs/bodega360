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

  console.error(error);
  response.status(500).json({ message: "Error interno del servidor." });
}
