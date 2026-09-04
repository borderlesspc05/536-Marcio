import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Lock,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { getSession } from "@/lib/auth/session";
import { formatPriceCents, getPlanGate, listActivePlans } from "@/features/billing/plan-gate";
import { describePlanFeatures, isConsultOnlyPlan } from "@/features/billing/plan-features";
import { getMarketingSettings } from "@/features/marketing/data";
import { isPlanAvailableForOrganization } from "@/features/billing/plan-catalog";
import { startPlanCheckoutFormAction } from "@/features/billing/actions";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PublicHeader } from "@/components/marketing/PublicHeader";
import { PublicFooter } from "@/components/marketing/PublicFooter";

type PageProps = {
  searchParams: Promise<{ plan?: string; canceled?: string }>;
};

const PAGE_SHELL =
  "min-h-screen bg-[radial-gradient(circle_at_12%_0%,rgba(225,29,138,0.10),transparent_38%),radial-gradient(circle_at_88%_6%,rgba(59,130,246,0.12),transparent_34%),#FCFCFD]";

/** Compensa o header fixo (top-6 + h-16) da área pública. */
const HEADER_OFFSET = "pt-32 md:pt-36";

const SELF_SERVICE_STEPS = [
  {
    title: "Confirme a contratação",
    description: "Revise o plano e os dados da conta que receberá a assinatura.",
  },
  {
    title: "Pague no ambiente do gateway",
    description: "Pix, boleto ou cartão em página segura, sem sair do fluxo.",
  },
  {
    title: "Recursos liberados",
    description: "A confirmação do pagamento ativa o plano automaticamente.",
  },
];

const CONSULT_STEPS = [
  {
    title: "Fale com um consultor",
    description: "Entendemos o volume de cotações e o perfil da sua operação.",
  },
  {
    title: "Receba a proposta comercial",
    description: "Escopo, prazos e investimento desenhados para o seu caso.",
  },
  {
    title: "Operação assistida no ar",
    description: "A equipe CotaCondo conduz as cotações de ponta a ponta.",
  },
];

export default async function CheckoutPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const planSlug = params.plan?.trim();
  const session = await getSession();
  const marketing = await getMarketingSettings();
  const paymentProvider =
    (process.env.PAYMENT_PROVIDER ?? "sandbox").toLowerCase() === "asaas"
      ? "Asaas"
      : "Sandbox";

  if (!planSlug) {
    const plans = await listActivePlans();
    return (
      <div className={PAGE_SHELL}>
        <PublicHeader blogUrl={marketing.blogUrl} />
        <main className={`${HEADER_OFFSET} pb-20`}>
          <Container>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">
              Contratação
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Escolha um plano para continuar
            </h1>
            <p className="mt-3 max-w-2xl text-neutral-600">
              Selecione abaixo o plano que combina com a sua operação. Você poderá revisar
              todos os detalhes antes de confirmar o pagamento.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <Link
                  key={plan.id}
                  href={`/checkout?plan=${plan.slug}`}
                  className="group flex flex-col rounded-3xl border border-black/5 bg-white/90 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#9333EA]/35 hover:shadow-[0_20px_45px_-28px_rgba(147,51,234,0.5)]"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#9333EA]">
                    {plan.audience}
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-neutral-900">{plan.name}</h2>
                  <p className="mt-3 text-2xl font-semibold text-neutral-900">
                    {isConsultOnlyPlan(plan) ? (
                      <span className="text-xl">Sob consulta</span>
                    ) : (
                      <>
                        {formatPriceCents(plan.priceCents)}
                        {plan.priceCents > 0 ? (
                          <span className="text-sm font-medium text-neutral-500"> /mês</span>
                        ) : null}
                      </>
                    )}
                  </p>
                  <p className="mt-3 flex-1 text-sm text-neutral-500">{plan.description}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#9333EA]">
                    Selecionar
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </Container>
        </main>
        <PublicFooter blogUrl={marketing.blogUrl} whatsappUrl={marketing.whatsappUrl} />
      </div>
    );
  }

  const plan = await firestoreDb.plan.findFirst({
    where: { slug: planSlug, isActive: true },
  });

  if (!plan) {
    return (
      <div className={PAGE_SHELL}>
        <PublicHeader blogUrl={marketing.blogUrl} />
        <main className={`${HEADER_OFFSET} pb-20`}>
          <Container>
            <div className="mx-auto max-w-lg rounded-3xl border border-black/5 bg-white/90 p-8 text-center shadow-sm">
              <h1 className="text-2xl font-bold text-neutral-900">Plano não encontrado</h1>
              <p className="mt-3 text-neutral-600">
                O link utilizado aponta para um plano inativo ou inexistente.
              </p>
              <Link href="/checkout" className="mt-6 inline-block">
                <Button>Ver planos disponíveis</Button>
              </Link>
            </div>
          </Container>
        </main>
        <PublicFooter blogUrl={marketing.blogUrl} whatsappUrl={marketing.whatsappUrl} />
      </div>
    );
  }

  if (!session) {
    redirect(`/acesse?next=${encodeURIComponent(`/checkout?plan=${plan.slug}`)}`);
  }

  if (!isPlanAvailableForOrganization(session.organizationType, plan.slug)) {
    redirect("/app/meu-plano?incompatible=1");
  }

  const gate = await getPlanGate(session.organizationId);
  const features = describePlanFeatures({
    featuresJson: plan.featuresJson,
    monthlyQuota: plan.monthlyQuota,
    audience: plan.audience,
  });

  const isCurrentPlan = Boolean(
    gate &&
      gate.planSlug === plan.slug &&
      ["active", "past_due"].includes(gate.subscriptionStatus),
  );
  const isConsultOnly = isConsultOnlyPlan(plan);
  const consultUrl = `${marketing.whatsappUrl}${marketing.whatsappUrl.includes("?") ? "&" : "?"}text=${encodeURIComponent(
    `Olá! Tenho interesse no plano ${plan.name} da CotaCondo e gostaria de falar com um consultor.`,
  )}`;

  return (
    <div className={PAGE_SHELL}>
      <PublicHeader blogUrl={marketing.blogUrl} />
      <main className={`${HEADER_OFFSET} pb-20`}>
        <Container>
          <Link
            href="/#planos"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para os planos
          </Link>

          <div className="mt-6 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#9333EA]">
              Contratação do plano
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Finalize a contratação do {plan.name}
            </h1>
            <p className="mt-3 text-neutral-600">
              {plan.description ||
                "Revise os detalhes do plano antes de confirmar o pagamento."}
            </p>
          </div>

          <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_384px]">
            <div className="space-y-6">
              <section className="rounded-3xl border border-black/5 bg-white/90 p-6 shadow-sm sm:p-8">
                <h2 className="text-lg font-semibold text-neutral-900">O que está incluído</h2>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-neutral-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#14B8A6]/12 text-[#0F766E]">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-3xl border border-black/5 bg-white/90 p-6 shadow-sm sm:p-8">
                <h2 className="text-lg font-semibold text-neutral-900">Como funciona</h2>
                <ol className="mt-5 space-y-5">
                  {(isConsultOnly ? CONSULT_STEPS : SELF_SERVICE_STEPS).map((step, index) => (
                    <li key={step.title} className="flex gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#E11D8A,#9333EA)] text-sm font-semibold text-white">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-neutral-900">{step.title}</p>
                        <p className="mt-1 text-sm text-neutral-500">{step.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="flex flex-col gap-4 rounded-3xl border border-black/5 bg-white/90 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">
                    Ficou com alguma dúvida?
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    Fale com um consultor antes de concluir a contratação.
                  </p>
                </div>
                <a href={marketing.whatsappUrl} target="_blank" rel="noreferrer">
                  <Button variant="secondary" className="w-full gap-2 sm:w-auto">
                    <MessageCircle className="h-4 w-4 text-[#25D366]" />
                    Falar no WhatsApp
                  </Button>
                </a>
              </section>
            </div>

            <aside className="order-first lg:order-last lg:sticky lg:top-32">
              <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(147,51,234,0.45)] sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                  Resumo do pedido
                </p>

                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <span className="text-base font-semibold text-neutral-900">{plan.name}</span>
                  <span className="text-sm text-neutral-500">
                    {plan.monthlyQuota == null
                      ? "Ilimitado"
                      : `${plan.monthlyQuota} cotações/mês`}
                  </span>
                </div>

                <p className="mt-5 text-4xl font-extrabold tracking-tight text-neutral-900">
                  {isConsultOnly ? (
                    <span className="text-3xl">Sob consulta</span>
                  ) : (
                    <>
                      {formatPriceCents(plan.priceCents)}
                      {!plan.isFree ? (
                        <span className="text-base font-medium text-neutral-500"> /mês</span>
                      ) : null}
                    </>
                  )}
                </p>

                <dl className="mt-6 space-y-2.5 border-t border-black/5 pt-5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-neutral-500">Cobrança</dt>
                    <dd className="font-medium text-neutral-900">
                      {isConsultOnly ? "Personalizada" : plan.isFree ? "Sem cobrança" : "Mensal"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-neutral-500">Conta</dt>
                    <dd className="max-w-[60%] truncate text-right font-medium text-neutral-900">
                      {session.organizationName}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-neutral-500">E-mail</dt>
                    <dd className="max-w-[60%] truncate text-right font-medium text-neutral-900">
                      {session.email}
                    </dd>
                  </div>
                  {gate ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-500">Plano atual</dt>
                      <dd className="font-medium text-neutral-900">{gate.planName}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mt-5 flex items-baseline justify-between border-t border-black/5 pt-5">
                  <span className="font-semibold text-neutral-900">Total hoje</span>
                  <span className="text-xl font-bold text-neutral-900">
                    {isCurrentPlan
                      ? "Já contratado"
                      : isConsultOnly
                        ? "—"
                        : formatPriceCents(plan.priceCents)}
                  </span>
                </div>

                {params.canceled ? (
                  <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Pagamento cancelado. Você pode tentar novamente quando quiser.
                  </p>
                ) : null}

                {isCurrentPlan ? (
                  <p className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Este já é o plano ativo da sua organização.
                  </p>
                ) : null}

                <div className="mt-6">
                  {isCurrentPlan ? (
                    <Button size="lg" className="w-full" disabled>
                      Plano já ativo
                    </Button>
                  ) : isConsultOnly ? (
                    <a href={consultUrl} target="_blank" rel="noreferrer">
                      <Button size="lg" className="w-full gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Falar com Consultor
                      </Button>
                    </a>
                  ) : (
                    <ActionForm
                      action={startPlanCheckoutFormAction}
                      size="lg"
                      submitLabel={plan.isFree ? "Ativar plano Free" : "Ir para pagamento"}
                      pendingLabel={
                        plan.isFree ? "Ativando plano..." : "Abrindo pagamento..."
                      }
                    >
                      <input type="hidden" name="planSlug" value={plan.slug} />
                    </ActionForm>
                  )}
                </div>

                <ul className="mt-6 space-y-2.5 text-xs text-neutral-500">
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[#14B8A6]" />
                    {isConsultOnly
                      ? "Proposta comercial sob medida, sem compromisso"
                      : `Pagamento processado pelo gateway ${paymentProvider}`}
                  </li>
                  <li className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 shrink-0 text-[#14B8A6]" />
                    Troque ou cancele o plano quando precisar
                  </li>
                  <li className="flex items-center gap-2">
                    <Lock className="h-4 w-4 shrink-0 text-[#14B8A6]" />
                    {isConsultOnly
                      ? "Seus dados não são compartilhados com terceiros"
                      : "Não armazenamos dados do seu cartão"}
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </Container>
      </main>
      <PublicFooter blogUrl={marketing.blogUrl} whatsappUrl={marketing.whatsappUrl} />
    </div>
  );
}
