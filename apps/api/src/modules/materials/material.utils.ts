import type { Material } from "@prisma/client";

export function isIncomplete(material: Pick<Material, "description" | "category" | "unit" | "location" | "mainPhotoPath" | "validated">) {
  return !material.description || !material.category || !material.unit || !material.location || !material.mainPhotoPath || !material.validated;
}

export function materialToJson(material: Material) {
  return {
    ...material,
    stock: material.stock ? Number(material.stock) : null,
    averageCost: material.averageCost ? Number(material.averageCost) : null,
    createdAt: material.createdAt.toISOString(),
    lastUpdatedAt: material.lastUpdatedAt.toISOString(),
    incomplete: isIncomplete(material)
  };
}
