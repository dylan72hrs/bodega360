import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { PrismaClient, Role } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const isProduction = process.env.NODE_ENV === "production";
  const adminUser = process.env.ADMIN_USER || (isProduction ? "" : "admin");
  const adminPassword = process.env.ADMIN_PASSWORD || (isProduction ? "" : "admin");

  if (!adminUser || !adminPassword) {
    throw new Error("ADMIN_USER y ADMIN_PASSWORD son obligatorios para ejecutar seed en produccion.");
  }

  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD) {
    console.warn("Usando admin/admin solo para desarrollo local. Configura ADMIN_USER y ADMIN_PASSWORD en Render.");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminUser },
    update: {
      name: "Administrador Bodega360",
      passwordHash,
      role: Role.ADMIN,
      active: true
    },
    create: {
      name: "Administrador Bodega360",
      email: adminUser,
      passwordHash,
      role: Role.ADMIN
    }
  });

  console.log(`Usuario administrador listo: ${adminUser}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
