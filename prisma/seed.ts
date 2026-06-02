import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin", 10);

  await prisma.user.upsert({
    where: { email: "admin" },
    update: {
      name: "Administrador Bodega360",
      passwordHash,
      role: Role.ADMIN,
      active: true
    },
    create: {
      name: "Administrador Bodega360",
      email: "admin",
      passwordHash,
      role: Role.ADMIN
    }
  });
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
