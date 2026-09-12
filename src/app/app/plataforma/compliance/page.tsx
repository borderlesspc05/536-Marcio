import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import {
  markOverdueCompliance,
  remindComplianceExpiring,
} from "@/features/compliance/expire";
import { ComplianceQueueClient } from "@/features/compliance/components/ComplianceQueueClient";

export default async function PlataformaCompliancePage() {
  await requireAuthorizedSession({
    types: [OrganizationType.master_admin],
    href: "/app/plataforma/compliance",
  });

  await markOverdueCompliance();
  await remindComplianceExpiring();

  const queue = await firestoreDb.complianceDocument.findMany({
    where: { status: { in: ["em_analise", "em_atraso"] } },
    orderBy: { createdAt: "asc" },
    include: {
      organization: { select: { name: true, document: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">Master Admin</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">Fila de compliance</h1>
        <p className="mt-2 text-neutral-600">
          Visualize o documento, aprove ou rejeite. Aprovação notifica o fornecedor e inicia 180 dias
          de validade, com lembrete 5 dias antes do vencimento.
        </p>
      </div>

      <ComplianceQueueClient
        queue={queue.map((doc) => ({
          id: doc.id,
          documentType: doc.documentType,
          fileName: doc.fileName,
          storagePath: doc.storagePath,
          contentType: doc.contentType ?? null,
          sizeBytes: doc.sizeBytes,
          validUntil: doc.validUntil.toISOString(),
          status: doc.status,
          createdAt: doc.createdAt.toISOString(),
          organizationName: doc.organization.name,
          organizationDocument: doc.organization.document,
        }))}
      />
    </div>
  );
}
