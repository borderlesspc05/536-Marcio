import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { markOverdueCompliance } from "@/features/compliance/expire";
import { ComplianceUploadForm } from "@/features/compliance/components/ComplianceUploadForm";
import { updateReputationLinksAction } from "@/features/compliance/actions";
import { formAction } from "@/lib/form-action";
import { Button } from "@/components/ui/Button";

const STATUS_LABEL: Record<string, string> = {
  aprovado: "Aprovado",
  em_analise: "Em análise",
  em_atraso: "Em atraso",
  negada: "Negada",
};

const STATUS_CLASS: Record<string, string> = {
  aprovado: "bg-emerald-50 text-emerald-800",
  em_analise: "bg-amber-50 text-amber-800",
  em_atraso: "bg-red-50 text-red-800",
  negada: "bg-neutral-100 text-neutral-700",
};

export default async function CompliancePage() {
  const session = await requireAuthorizedSession({
    types: [OrganizationType.fornecedor],
    href: "/app/compliance",
  });

  await markOverdueCompliance(session.organizationId);

  const [documents, organization] = await Promise.all([
    firestoreDb.complianceDocument.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      include: { replaces: { select: { id: true, documentType: true, createdAt: true } } },
    }),
    firestoreDb.organization.findUniqueOrThrow({ where: { id: session.organizationId } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">Compliance</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">Central de documentação</h1>
        <p className="mt-2 text-neutral-600">
          Envie múltiplos documentos (certidões, contrato social, CREA…) e links opcionais de reputação.
        </p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Reputação (opcional)</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Exibidos no comparativo do solicitante para consulta individual.
        </p>
        <form action={formAction(updateReputationLinksAction)} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Perfil Google
            <input
              name="googleProfileUrl"
              type="url"
              defaultValue={organization.googleProfileUrl ?? ""}
              placeholder="https://maps.google.com/..."
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm">
            Reclame Aqui
            <input
              name="reclameAquiUrl"
              type="url"
              defaultValue={organization.reclameAquiUrl ?? ""}
              placeholder="https://www.reclameaqui.com.br/..."
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <Button type="submit">Salvar links</Button>
        </form>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/80">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/5 bg-black/[0.02] text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Validade</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Arquivo</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b border-black/5 last:border-0 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{doc.documentType}</p>
                    {doc.replaces ? (
                      <p className="mt-1 text-xs text-neutral-400">
                        Renovação de envio {doc.replaces.createdAt.toLocaleDateString("pt-BR")}
                      </p>
                    ) : null}
                    {doc.reviewNotes ? (
                      <p className="mt-1 text-xs text-neutral-500">Nota: {doc.reviewNotes}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {doc.validUntil.toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[doc.status]}`}
                    >
                      {STATUS_LABEL[doc.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{doc.fileName}</td>
                </tr>
              ))}
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                    Nenhum documento enviado ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ComplianceUploadForm />
      </div>
    </div>
  );
}
