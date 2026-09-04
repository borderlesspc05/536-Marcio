import { firestoreDb } from "@/lib/firebase/firestore-db";

/** Marca documentos aprovados/em análise com validade vencida como em_atraso. */
export async function markOverdueCompliance(organizationId?: string): Promise<number> {
  const now = new Date();
  const result = await firestoreDb.complianceDocument.updateMany({
    where: {
      status: { in: ["aprovado", "em_analise"] },
      validUntil: { lt: now },
      ...(organizationId ? { organizationId } : {}),
    },
    data: { status: "em_atraso" },
  });
  return result.count;
}
