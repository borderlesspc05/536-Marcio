import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { reviewMigrationAction } from "@/features/migration/actions";
import { formAction } from "@/lib/form-action";
import { Button } from "@/components/ui/Button";

export default async function MigracoesAdminPage() {
  await requireAuthorizedSession({
    types: [OrganizationType.master_admin],
    href: "/app/plataforma/migracoes",
  });

  const migrations = await firestoreDb.organizationMigration.findMany({
    include: { targetPlan: true, organization: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Migrações</h1>
        <p className="mt-2 text-neutral-600">
          Síndico → Administradora. Plano Free é sempre rejeitado.
        </p>
      </div>
      <div className="space-y-3">
        {migrations.map((item) => (
          <div key={item.id} className="rounded-2xl border border-black/5 bg-white/80 p-4">
            <p className="font-semibold">
              {item.organization.name} · {item.fromType} → {item.toType}
            </p>
            <p className="text-sm text-neutral-600">
              Plano: {item.targetPlan.name} · Status: {item.status}
            </p>
            {item.targetPlan.isFree ? (
              <p className="mt-2 text-sm font-medium text-red-700">
                Bloqueado: destino Free inválido
              </p>
            ) : null}
            {["pending_payment", "pending_review"].includes(item.status) &&
            !item.targetPlan.isFree ? (
              <form action={formAction(reviewMigrationAction)} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="migrationId" value={item.id} />
                <input
                  name="notes"
                  placeholder="Notas"
                  className="h-9 rounded-xl border border-black/10 px-3 text-sm"
                />
                <Button type="submit" name="decision" value="approve" size="sm">
                  Aprovar
                </Button>
                <Button type="submit" name="decision" value="reject" size="sm" variant="secondary">
                  Rejeitar
                </Button>
              </form>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
