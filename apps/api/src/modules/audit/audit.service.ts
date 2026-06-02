import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";

type AuditInput = {
  action: AuditAction;
  entity: string;
  entityId?: string;
  userId?: string;
  materialId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  note?: string;
};

export async function writeAudit(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      userId: input.userId,
      materialId: input.materialId,
      before: input.before ?? undefined,
      after: input.after ?? undefined,
      note: input.note
    }
  });
}
