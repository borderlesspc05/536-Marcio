import { firestoreDb } from "@/lib/firebase/firestore-db";

type AuditInput = {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

export async function writeAuditLog(input: AuditInput) {
  await firestoreDb.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      ip: input.ip ?? null,
    },
  });
}
