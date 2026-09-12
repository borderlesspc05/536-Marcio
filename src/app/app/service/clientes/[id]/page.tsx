import Link from "next/link";
import { notFound } from "next/navigation";
import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { getServiceClient } from "@/features/master-service/data";
import {
  addServiceClientManagerAction,
  updateServiceClientAction,
} from "@/features/master-service/actions";
import { ServiceClientManagerRow } from "@/features/master-service/components/ServiceClientManagerRow";
import { publicWhitelabelUrl } from "@/features/master-service/whitelabel-url";
import { formAction } from "@/lib/form-action";
import { Button } from "@/components/ui/Button";

type PageProps = { params: Promise<{ id: string }> };

export default async function ServiceClienteDetailPage({ params }: PageProps) {
  const session = await requireAuthorizedSession({
    types: [OrganizationType.master_service],
  });
  const { id } = await params;
  const client = await getServiceClient(id, session.organizationId);
  if (!client) notFound();

  const publicLink = publicWhitelabelUrl(client.solicitationLinkSlug);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/service/clientes" className="text-sm font-semibold text-[#9333EA]">
          ← Clientes
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-neutral-900">{client.displayName}</h1>
        <p className="mt-2 text-neutral-600">
          {client.clientOrg.name} · whitelabel e hierarquia de acessos
        </p>
      </div>

      <form
        action={formAction(updateServiceClientAction)}
        className="grid gap-3 rounded-2xl border border-black/5 bg-white/80 p-5 md:grid-cols-2"
      >
        <input type="hidden" name="id" value={client.id} />
        <label className="text-sm">
          Nome de exibição
          <input
            name="displayName"
            defaultValue={client.displayName}
            className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
          />
        </label>
        <label className="text-sm">
          Slug do link (ex.: selladm)
          <input
            name="solicitationLinkSlug"
            defaultValue={client.solicitationLinkSlug}
            pattern="[a-z0-9-]+"
            className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3 font-mono text-sm"
          />
        </label>
        <label className="text-sm">
          Logo URL
          <input
            name="logoUrl"
            defaultValue={client.logoUrl ?? ""}
            className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
          />
        </label>
        <label className="text-sm">
          Cor primária
          <input
            name="primaryColor"
            type="color"
            defaultValue={client.primaryColor}
            className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
          />
        </label>
        <label className="text-sm">
          Cor secundária
          <input
            name="secondaryColor"
            type="color"
            defaultValue={client.secondaryColor}
            className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
          />
        </label>
        <label className="text-sm md:col-span-2">
          Link de pagamento recorrente
          <input
            name="paymentLinkUrl"
            defaultValue={client.paymentLinkUrl ?? ""}
            className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
          />
        </label>
        <label className="text-sm">
          API IA (RIF)
          <select
            name="aiApiMode"
            defaultValue={client.aiApiMode}
            className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
          >
            <option value="platform">Plataforma</option>
            <option value="client">Cliente</option>
          </select>
        </label>
        <label className="text-sm">
          Chave API do cliente (opcional)
          <input
            name="aiApiKey"
            placeholder={client.aiApiKeyMasked ?? "sk-..."}
            className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="solicitationLinkActive"
            defaultChecked={client.solicitationLinkActive}
          />
          Link de solicitação ativo
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={client.isActive} />
          Cliente adimplente / ativo
        </label>
        <label className="text-sm md:col-span-2">
          Observações
          <input
            name="notes"
            defaultValue={client.notes ?? ""}
            className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
          />
        </label>
        <div className="md:col-span-2">
          <p className="text-xs text-neutral-500">
            Link exclusivo:{" "}
            <a href={publicLink} className="font-semibold text-[#9333EA] hover:underline" target="_blank" rel="noreferrer">
              {publicLink.replace(/^https?:\/\//, "")}
            </a>
            <span className="ml-2 text-neutral-400">(/s/{client.solicitationLinkSlug} também funciona)</span>
          </p>
          <Button type="submit" className="mt-3">
            Salvar whitelabel
          </Button>
        </div>
      </form>

      <section className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Gerentes e assistentes</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Todo usuário operacional fica vinculado a este cliente para relatórios por carteira.
          Criar, editar, reenviar acesso ou excluir.
        </p>
        <ul className="mt-4 space-y-1 text-sm">
          {client.managers.length === 0 ? (
            <li className="text-neutral-500">Nenhum gerente vinculado.</li>
          ) : (
            client.managers.map((manager) => (
              <ServiceClientManagerRow
                key={manager.id}
                managerId={manager.id}
                name={manager.name}
                email={manager.email}
                roleLabel={manager.roleLabel}
              />
            ))
          )}
        </ul>
        <form
          action={formAction(addServiceClientManagerAction)}
          className="mt-4 grid gap-3 md:grid-cols-4"
        >
          <input type="hidden" name="serviceClientId" value={client.id} />
          <input
            name="name"
            required
            placeholder="Nome"
            className="h-10 rounded-xl border border-black/10 px-3 text-sm"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="E-mail"
            className="h-10 rounded-xl border border-black/10 px-3 text-sm"
          />
          <select name="roleLabel" className="h-10 rounded-xl border border-black/10 px-3 text-sm">
            <option value="gerente">Gerente</option>
            <option value="assistente">Assistente</option>
          </select>
          <Button type="submit">Vincular</Button>
        </form>
      </section>
    </div>
  );
}
