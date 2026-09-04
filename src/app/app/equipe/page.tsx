import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { inviteTeamMemberAction } from "@/features/referrals/actions";
import {
  inviteExternalApproverAction,
  removeExternalApproverAction,
  updateExternalApproverScopesAction,
} from "@/features/external-approver/actions";
import { formAction } from "@/lib/form-action";
import { Button } from "@/components/ui/Button";

export default async function EquipePage() {
  const session = await requireAuthorizedSession({
    types: [OrganizationType.administradora],
    href: "/app/equipe",
  });

  const [members, condominiums] = await Promise.all([
    firestoreDb.organizationMember.findMany({
      where: { organizationId: session.organizationId },
      include: {
        user: {
          include: {
            externalApproverScopes: {
              where: { organizationId: session.organizationId },
              include: { condominium: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    firestoreDb.condominium.findMany({
      where: { organizationId: session.organizationId, archivedAt: null },
      orderBy: { name: "asc" },
    }),
  ]);

  const canInvite = session.role === MemberRole.master;
  const serviceClient = await firestoreDb.serviceClient.findUnique({
    where: { clientOrgId: session.organizationId },
  });
  const externalApprovers = members.filter(
    (member) => member.role === MemberRole.external_approver,
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">Equipe</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">Usuários da administradora</h1>
        <p className="mt-2 text-neutral-600">
          Master convida operacionais, outros masters e aprovadores externos (síndicos).
        </p>
        {serviceClient ? (
          <p className="mt-2 text-sm text-neutral-500">
            Portal do aprovador:{" "}
            <a href={`/s/${serviceClient.solicitationLinkSlug}`} className="font-semibold text-[#9333EA]">
              /s/{serviceClient.solicitationLinkSlug}
            </a>
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/80">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/5 bg-black/[0.02] text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Papel</th>
              <th className="px-4 py-3 font-medium">Escopo</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3 font-medium">{member.user.name}</td>
                <td className="px-4 py-3 text-neutral-600">{member.user.email}</td>
                <td className="px-4 py-3 capitalize">
                  {member.role === MemberRole.external_approver
                    ? "Aprovador Externo"
                    : member.role}
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {member.role === MemberRole.external_approver
                    ? member.user.externalApproverScopes.map((s) => s.condominium.name).join(", ") ||
                      "—"
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canInvite ? (
        <>
          <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
            <h2 className="font-semibold">Convidar usuário interno</h2>
            <form action={formAction(inviteTeamMemberAction)} className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Nome
                <input name="name" required className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3" />
              </label>
              <label className="text-sm">
                E-mail
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
                />
              </label>
              <label className="text-sm">
                Papel
                <select name="role" className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3">
                  <option value="operational">Operacional</option>
                  <option value="master">Master</option>
                </select>
              </label>
              <div className="flex items-end">
                <Button type="submit">Enviar convite</Button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50/40 p-5">
            <h2 className="font-semibold">Cadastrar Aprovador Externo</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Perfil com acesso restrito às cotações e calendário dos condomínios selecionados.
            </p>
            <form
              action={formAction(inviteExternalApproverAction)}
              className="mt-4 grid gap-3 md:grid-cols-2"
            >
              <label className="text-sm">
                Nome
                <input name="name" required className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3" />
              </label>
              <label className="text-sm">
                E-mail
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
                />
              </label>
              <fieldset className="md:col-span-2 text-sm">
                <legend className="font-medium">Condomínios vinculados *</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {condominiums.map((condo) => (
                    <label key={condo.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
                      <input type="checkbox" name="condominiumIds" value={condo.id} />
                      {condo.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="md:col-span-2">
                <Button type="submit">Cadastrar aprovador</Button>
              </div>
            </form>
          </div>

          {externalApprovers.length > 0 ? (
            <div className="space-y-4">
              <h2 className="font-semibold">Gerenciar aprovadores externos</h2>
              {externalApprovers.map((member) => {
                const linked = new Set(
                  member.user.externalApproverScopes.map((scope) => scope.condominiumId),
                );
                return (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-black/5 bg-white/80 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-neutral-900">{member.user.name}</p>
                        <p className="text-sm text-neutral-500">{member.user.email}</p>
                      </div>
                      <form action={formAction(removeExternalApproverAction)}>
                        <input type="hidden" name="userId" value={member.userId} />
                        <Button type="submit" variant="secondary" size="sm">
                          Excluir aprovador
                        </Button>
                      </form>
                    </div>
                    <form
                      action={formAction(updateExternalApproverScopesAction)}
                      className="mt-4 space-y-3"
                    >
                      <input type="hidden" name="userId" value={member.userId} />
                      <fieldset className="text-sm">
                        <legend className="font-medium">Condomínios vinculados</legend>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {condominiums.map((condo) => (
                            <label
                              key={condo.id}
                              className="flex items-center gap-2 rounded-lg border border-black/5 bg-neutral-50 px-3 py-2"
                            >
                              <input
                                type="checkbox"
                                name="condominiumIds"
                                value={condo.id}
                                defaultChecked={linked.has(condo.id)}
                              />
                              {condo.name}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <Button type="submit" size="sm">
                        Salvar vínculos
                      </Button>
                    </form>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-neutral-500">Apenas o Master pode convidar usuários.</p>
      )}
    </div>
  );
}
