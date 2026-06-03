import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: "../../.env" });
dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const localDatabaseUrl = "postgresql://bodega360:bodega360@localhost:5432/bodega360?schema=public";
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const envSchema = z.object({
  NODE_ENV: z.preprocess(emptyToUndefined, z.string().default("development")),
  DATABASE_URL: z.preprocess(emptyToUndefined, z.string().min(1).default(localDatabaseUrl)),
  JWT_SECRET: z.preprocess(emptyToUndefined, z.string().min(16).default("bodega360-local-jwt-secret-change-me")),
  ADMIN_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  ADMIN_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.preprocess(emptyToUndefined, z.string().optional()),
  WEB_ORIGIN: z.preprocess(emptyToUndefined, z.string().optional())
});

const parsed = envSchema.parse(process.env);

if (isProduction && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL es obligatorio en produccion.");
}

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET es obligatorio en produccion.");
}

export const env = {
  ...parsed,
  CORS_ORIGIN: parsed.CORS_ORIGIN || parsed.WEB_ORIGIN || "http://localhost:5173"
};
