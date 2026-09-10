/**
 * Dispara side-effects a partir de um Domain Event já persistido.
 * Preferir `emitDomainEvent` (persist + dispatch). Use isto só quando o evento
 * já foi gravado via `recordDomainEvent` antes do dispatch.
 */
export async function notifyAfterDomainEvent(input: {
  type: string;
  entityType: string;
  entityId: string;
  organizationId?: string | null;
  payload?: Record<string, unknown> | string | null;
}) {
  let payload: Record<string, unknown> = {};
  if (typeof input.payload === "string") {
    try {
      payload = JSON.parse(input.payload) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  } else if (input.payload && typeof input.payload === "object") {
    payload = input.payload;
  }

  const { dispatchDomainEvent } = await import("@/lib/domain-events");
  await dispatchDomainEvent({
    type: input.type,
    entityType: input.entityType,
    entityId: input.entityId,
    organizationId: input.organizationId,
    payload,
  });
}
