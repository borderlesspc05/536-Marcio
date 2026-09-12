import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { markOverdueCompliance } from "@/features/compliance/expire";
import { ComplianceUploadForm } from "@/features/compliance/components/ComplianceUploadForm";
import { updateReputationLinksAction } from "@/features/compliance/actions";
import { getComplianceValidityView } from "@/features/compliance/validity-status";
import { formAction } from "@/lib/form-action";
import { Button } from "@/components/ui/Button";

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
          Envie documentos e complete os links de reputação para aumentar sua competitividade.
        </p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Reputação (obrigatório)</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Exibidos no comparativo do solicitante para consulta individual.
        </p>
        <p className="mt-2 rounded-xl bg-[#9333EA]/8 px-3 py-2 text-sm text-[#6b21a8]">
          Preencha os campos e aumente suas oportunidades de negócio.
        </p>
        <form action={formAction(updateReputationLinksAction)} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            Perfil Google <span className="text-red-600">*</span>
            <input
              name="googleProfileUrl"
              type="url"
              required
              defaultValue={organization.googleProfileUrl ?? ""}
              placeholder="https://maps.google.com/..."
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
            <span className="mt-1 block text-xs leading-5 text-neutral-500">
              Como cadastrar o link correto: abra o Google Maps ou a ficha do seu negócio no Google,
              clique em Compartilhar e copie o link completo (deve começar com https:// e apontar
              para o perfil/estabelecimento). Evite links encurtados ou de busca genérica.
            </span>
          </label>
          <label className="text-sm md:col-span-2">
            Reclame Aqui <span className="text-red-600">*</span>
            <input
              name="reclameAquiUrl"
              type="url"
              required
              defaultValue={organization.reclameAquiUrl ?? ""}
              placeholder="https://www.reclameaqui.com.br/..."
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <Button type="submit">Salvar links</Button>
        </form>
      </div>

      <p className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
        Documentações aprovadas em dia aumentam a possibilidade de fechamentos de negócios, trazendo
        mais segurança aos solicitantes.
      </p>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
          Em dia · até 6 meses
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-900">
          Atenção · 15 dias ou menos
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-800">
          Vencido · prazo esgotado
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/80">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/5 bg-black/[0.02] text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Dias</th>
                <th className="px-4 py-3 font-medium">Arquivo</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const validity = getComplianceValidityView({
                  status: doc.status,
                  validUntil: doc.validUntil,
                });
                const fileHref = `/api/app/files?path=${encodeURIComponent(doc.storagePath)}&name=${encodeURIComponent(doc.fileName)}&inline=1`;
                return (
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
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${validity.className}`}
                      >
                        {validity.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {validity.daysLabel ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={fileHref}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[#c10089] hover:underline"
                      >
                        {doc.fileName}
                      </a>
                    </td>
                  </tr>
                );
              })}
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
