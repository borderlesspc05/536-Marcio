import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { can, getPlanGate } from "@/features/billing/plan-gate";
import { FREE_PARTNERSHIP_MESSAGE } from "@/features/partnerships/messages";
import {
  createPartnershipAction,
  endPartnershipAction,
} from "@/features/partnerships/actions";
import { formAction } from "@/lib/form-action";
import { Button } from "@/components/ui/Button";

export default async function ParceriasPage() {
  const session = await requireAuthorizedSession({
    types: [OrganizationType.administradora],
    roles: [MemberRole.master],
    href: "/app/parcerias",
  });

  const gate = await getPlanGate(session.organizationId);
  if (!can(gate, "partnerships")) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-neutral-900">Parcerias</h1>
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Gestão de parcerias é exclusiva do plano Administradora Premium.
        </p>
      </div>
    );
  }

  const settings = await firestoreDb.platformSettings.findUnique({ where: { id: "default" } });
  const [partnerships, suppliers] = await Promise.all([
    firestoreDb.partnership.findMany({
      where: { administradoraOrgId: session.organizationId, status: "active" },
      include: {
        supplier: {
          include: {
            subscriptions: {
              where: { status: "active" },
              include: { plan: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    firestoreDb.organization.findMany({
      where: { type: "fornecedor" },
      orderBy: { name: "asc" },
      include: {
        subscriptions: {
          where: { status: "active" },
          include: { plan: true },
          take: 1,
        },
      },
    }),
  ]);

  const partnerIds = new Set(partnerships.map((item) => item.supplierOrgId));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">Premium</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">Parcerias</h1>
        <p className="mt-2 text-neutral-600">
          Vincule fornecedores parceiros. Trava Growth Loop:{" "}
          {settings?.partnershipLockEnabled ? "ativa" : "desativada"} (Master Admin).
        </p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Parceiros ativos</h2>
        <div className="mt-4 space-y-3">
          {partnerships.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhum parceiro vinculado.</p>
          ) : (
            partnerships.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/5 p-3"
              >
                <div>
                  <p className="font-medium">{item.supplier.name}</p>
                  <p className="text-xs text-neutral-500">
                    {item.supplier.subscriptions[0]?.plan.name ?? "Sem plano"}
                  </p>
                </div>
                <form action={formAction(endPartnershipAction)}>
                  <input type="hidden" name="partnershipId" value={item.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    Encerrar
                  </Button>
                </form>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Adicionar parceiro</h2>
        <p className="mt-1 text-sm text-neutral-500">{FREE_PARTNERSHIP_MESSAGE}</p>
        <div className="mt-4 space-y-3">
          {suppliers
            .filter((supplier) => !partnerIds.has(supplier.id))
            .map((supplier) => {
              const plan = supplier.subscriptions[0]?.plan;
              const isFree = plan?.isFree ?? true;
              return (
                <div
                  key={supplier.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/5 p-3"
                >
                  <div>
                    <p className="font-medium">{supplier.name}</p>
                    <p className={`text-xs ${isFree ? "text-amber-700" : "text-neutral-500"}`}>
                      {plan?.name ?? "Sem plano"}
                      {isFree ? " · Free (bloqueado se trava ativa)" : ""}
                    </p>
                  </div>
                  <form action={formAction(createPartnershipAction)}>
                    <input type="hidden" name="supplierOrgId" value={supplier.id} />
                    <Button type="submit" size="sm">
                      Vincular
                    </Button>
                  </form>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
