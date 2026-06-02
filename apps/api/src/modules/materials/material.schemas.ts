import { MaterialStatus } from "@prisma/client";
import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (value === undefined || value === null || value === "" ? null : String(value)),
  z.string().trim().optional().nullable().transform((value) => value || null)
);
const optionalNumber = z.preprocess(
  (value) => (value === undefined || value === null || value === "" ? null : value),
  z.coerce.number().optional().nullable()
);
const requiredText = z.coerce.string().trim().min(1);

function parseValidated(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["si", "sí", "s", "true", "1", "validado"].includes(normalized);
}

function parseStatus(value: unknown) {
  const normalized = String(value ?? "ACTIVE").trim().toUpperCase();
  const map: Record<string, MaterialStatus> = {
    ACTIVO: MaterialStatus.ACTIVE,
    ACTIVE: MaterialStatus.ACTIVE,
    INACTIVO: MaterialStatus.INACTIVE,
    INACTIVE: MaterialStatus.INACTIVE,
    OBSOLETO: MaterialStatus.OBSOLETE,
    OBSOLETE: MaterialStatus.OBSOLETE
  };
  return map[normalized] ?? MaterialStatus.ACTIVE;
}

export const materialInputSchema = z.object({
  code: requiredText,
  alternateCode: optionalText,
  name: requiredText,
  description: optionalText,
  category: optionalText,
  brand: optionalText,
  model: optionalText,
  unit: optionalText,
  stock: optionalNumber,
  averageCost: optionalNumber,
  currency: z.coerce.string().trim().default("CLP"),
  location: optionalText,
  status: z.preprocess(parseStatus, z.nativeEnum(MaterialStatus)).default(MaterialStatus.ACTIVE),
  validated: z.preprocess(parseValidated, z.boolean()).default(false)
});

export const materialUpdateSchema = materialInputSchema.partial().extend({
  validated: z.coerce.boolean().optional()
});
