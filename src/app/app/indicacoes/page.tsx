import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { registerReferralRewardAction } from "@/features/referrals/actions";
import { resolveReferralStatus } from "@/features/referrals/rewards";
import { formAction } from "@/lib/form-action";
import { formatPriceCents } from "@/features/billing/money";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";

export default async function IndicacoesPage() {
  const session = await requireAuthorizedSession({
    types: [
      OrganizationType.administradora,
      OrganizationType.sindico,
      OrganizationType.fornecedor,
    ],
    href: "/app/indicacoes",
  });

  let user = await firestoreDb.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!user.referralCode) {
    const code = `CC-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    user = await firestoreDb.user.update({
      where: { id: session.userId },
      data: { referralCode: code },
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const referralLink = `${baseUrl}/cadastro?ref=${user.referralCode}`;

  const [referrals, rewards] = await Promise.all([
    firestoreDb.user.findMany({
      where: { referredByUserId: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        memberships: {
          include: { organization: { select: { name: true, type: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    firestoreDb.referralReward.findMany({
      where: { referrerUserId: session.userId },
      include: { referred: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const withStatus = await Promise.all(
    referrals.map(async (item) => ({
      ...item,
      status: await resolveReferralStatus(item.id),
      orgName: item.memberships[0]?.organization.name ?? "—",
    })),
  );

  const totalRewards = rewards.reduce((sum, item) => sum + item.amountCents, 0);
  const paidCount = withStatus.filter((item) => item.status === "ativo_pago").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">Growth</p>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">Indicações</h1>
        <p className="mt-2 text-neutral-600">
          Link unificado, status Free/Pago e histórico de cashback/comissão.
        </p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <p className="text-sm text-neutral-500">Seu link de indicação</p>
        <p className="mt-2 break-all font-mono text-sm font-semibold text-[#9333EA]">{referralLink}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <CopyButton value={referralLink} />
          <p className="text-xs text-neutral-500">Código: {user.referralCode}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <p className="text-sm text-neutral-500">Indicados</p>
          <p className="mt-2 text-3xl font-bold">{withStatus.length}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <p className="text-sm text-neutral-500">Ativos pagos</p>
          <p className="mt-2 text-3xl font-bold">{paidCount}</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <p className="text-sm text-neutral-500">Total acumulado</p>
          <p className="mt-2 text-3xl font-bold">{formatPriceCents(totalRewards)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Indicados rastreados</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {withStatus.length === 0 ? (
            <li className="text-neutral-500">Nenhuma indicação ainda.</li>
          ) : (
            withStatus.map((item) => (
              <li key={item.id} className="rounded-xl border border-black/5 px-3 py-2">
                <span className="font-medium">{item.name}</span>
                {item.orgName !== "—" ? ` · ${item.orgName}` : ""} · {item.email}
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    item.status === "ativo_pago"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {item.status === "ativo_pago" ? "ativo_pago" : "cadastrado_free"}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>

      {session.organizationType === OrganizationType.administradora &&
      session.role === "master" ? (
        <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
          <h2 className="font-semibold">Registrar ganho / abatimento</h2>
          <form action={formAction(registerReferralRewardAction)} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Indicado
              <select name="referredUserId" required className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3">
                <option value="">Selecione</option>
                {withStatus.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Tipo
              <select name="kind" className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3">
                <option value="recurring_credit">Crédito recorrente</option>
                <option value="discount">Abatimento</option>
                <option value="commission_share">Share de comissão</option>
              </select>
            </label>
            <label className="text-sm">
              Valor (R$)
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                required
                className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3"
              />
            </label>
            <label className="text-sm">
              Notas
              <input name="notes" className="mt-1 h-10 w-full rounded-xl border border-black/10 px-3" />
            </label>
            <Button type="submit">Registrar</Button>
          </form>
        </div>
      ) : null}

      <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
        <h2 className="font-semibold">Histórico de pagamentos e resgates</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {rewards.length === 0 ? (
            <li className="text-neutral-500">Sem lançamentos.</li>
          ) : (
            rewards.map((item) => (
              <li key={item.id} className="rounded-xl border border-black/5 px-3 py-2">
                {item.referred.name} · {item.kind} · {formatPriceCents(item.amountCents)}
                {item.yearMonth ? ` · ${item.yearMonth}` : ""}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
