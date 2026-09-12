import Link from "next/link";
import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { listServiceClients } from "@/features/master-service/data";
import { createServiceClientAction } from "@/features/master-service/actions";
import { publicWhitelabelUrl } from "@/features/master-service/whitelabel-url";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { formAction } from "@/lib/form-action";
import { Button } from "@/components/ui/Button";

export default async function ServiceClientesPage() {
  const session = await requireAuthorizedSession({
    types: [OrganizationType.master_service],
    href: "/app/service/clientes",
  });

  const [clients, candidateOrgs] = await Promise.all([
    listServiceClients(session.organizationId),
    firestoreDb.organization.findMany({
      where: {
        type: { in: [OrganizationType.administradora, OrganizationType.sindico] },
        serviceClientProfile: null,
      },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">
          Master Service
        </p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">Clientes Cota Service</h1>
        <p className="mt-2 text-neutral-600">
          Whitelabel, link de solicitação, pagamento recorrente e vínculo de gerentes. Somente
          empresas previamente cadastradas entram neste plano.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/80">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Organização</th>
              <th className="px-4 py-3 font-medium">Link</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Cotações</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => {
              const link = publicWhitelabelUrl(client.solicitationLinkSlug).replace(
                /^https?:\/\//,
                "",
              );
              return (
                <tr key={client.id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-3 font-medium">{client.displayName}</td>
                  <td className="px-4 py-3 text-neutral-600">{client.clientOrg.name}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    <span className="font-mono text-xs">{link}</span>
                    {!client.solicitationLinkActive ? (
                      <span className="ml-2 text-xs text-amber-700">(inativo)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{client.isActive ? "Ativo" : "Bloqueado"}</td>
                  <td className="px-4 py-3">{client._count.quotations}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/app/service/clientes/${client.id}`}
                      className="font-semibold text-[#9333EA]"
                    >
                      Configurar
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Cadastrar cliente Cota Service</h2>
        <form action={formAction(createServiceClientAction)} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            Organização existente
            <select
              name="clientOrgId"
              required
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            >
              <option value="">Selecione</option>
              {candidateOrgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.type})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Nome de exibição (whitelabel)
            <input
              name="displayName"
              required
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm">
            Slug do link (ex.: selladm)
            <input
              name="solicitationLinkSlug"
              placeholder="selladm"
              pattern="[a-z0-9-]+"
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3 font-mono text-sm"
            />
          </label>
          <label className="text-sm">
            Logo URL
            <input name="logoUrl" className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3" />
          </label>
          <label className="text-sm">
            Cor primária
            <input
              name="primaryColor"
              type="color"
              defaultValue="#9333EA"
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm">
            Cor secundária
            <input
              name="secondaryColor"
              type="color"
              defaultValue="#14B8A6"
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Link de pagamento recorrente
            <input
              name="paymentLinkUrl"
              placeholder="https://..."
              className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
            />
          </label>
          <label className="text-sm">
            API de IA (RIF)
            <select name="aiApiMode" className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3">
              <option value="platform">Plataforma CotaCondo</option>
              <option value="client">Chave do cliente</option>
            </select>
          </label>
          <label className="text-sm">
            Observações
            <input name="notes" className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3" />
          </label>
          <div className="flex items-end md:col-span-2">
            <Button type="submit">Criar cliente</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
