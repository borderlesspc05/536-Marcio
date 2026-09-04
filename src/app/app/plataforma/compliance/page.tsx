import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { markOverdueCompliance } from "@/features/compliance/expire";
import { reviewComplianceDocumentAction } from "@/features/compliance/actions";
import { Button } from "@/components/ui/Button";

export default async function PlataformaCompliancePage() {
  await requireAuthorizedSession({
    types: [OrganizationType.master_admin],
    href: "/app/plataforma/compliance",
  });

  await markOverdueCompliance();

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
          Aprove ou rejeite documentos enviados pelos fornecedores.
        </p>
      </div>

      <div className="space-y-4">
        {queue.map((doc) => (
          <div
            key={doc.id}
            className="rounded-2xl border border-black/5 bg-white/80 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-neutral-900">{doc.documentType}</p>
                <p className="mt-1 text-sm text-neutral-600">
                  {doc.organization.name} · {doc.fileName}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Validade {doc.validUntil.toLocaleDateString("pt-BR")} · Status {doc.status}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form
                  action={async (formData) => {
                    "use server";
                    await reviewComplianceDocumentAction(formData);
                  }}
                  className="flex gap-2"
                >
                  <input type="hidden" name="documentId" value={doc.id} />
                  <input type="hidden" name="decision" value="aprovado" />
                  <input
                    name="reviewNotes"
                    placeholder="Nota (opcional)"
                    className="h-10 rounded-xl border border-black/10 px-3 text-sm"
                  />
                  <Button type="submit">Aprovar</Button>
                </form>
                <form
                  action={async (formData) => {
                    "use server";
                    await reviewComplianceDocumentAction(formData);
                  }}
                >
                  <input type="hidden" name="documentId" value={doc.id} />
                  <input type="hidden" name="decision" value="negada" />
                  <input type="hidden" name="reviewNotes" value="Documento rejeitado" />
                  <Button type="submit" variant="secondary">
                    Rejeitar
                  </Button>
                </form>
              </div>
            </div>
          </div>
        ))}
        {queue.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-black/10 px-4 py-10 text-center text-neutral-500">
            Nenhuma pendência na fila.
          </p>
        ) : null}
      </div>
    </div>
  );
}
