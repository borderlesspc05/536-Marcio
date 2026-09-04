import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, LayoutDashboard, Receipt } from "lucide-react";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { formatPriceCents } from "@/features/billing/plan-gate";
import { getMarketingSettings } from "@/features/marketing/data";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PublicHeader } from "@/components/marketing/PublicHeader";
import { PublicFooter } from "@/components/marketing/PublicFooter";

type PageProps = {
  searchParams: Promise<{ checkout?: string }>;
};

const NEXT_STEPS = [
  {
    icon: LayoutDashboard,
    title: "Acesse o painel",
    description: "Os recursos do plano já aparecem no menu da sua organização.",
    href: "/app",
    cta: "Ir para o dashboard",
  },
  {
    icon: FileText,
    title: "Abra sua primeira cotação",
    description: "Cadastre o condomínio e envie a solicitação aos fornecedores.",
    href: "/app/cotacoes",
    cta: "Criar cotação",
  },
  {
    icon: Receipt,
    title: "Acompanhe a cobrança",
    description: "Faturas, ciclo de renovação e histórico ficam em Meu plano.",
    href: "/app/meu-plano",
    cta: "Ver meu plano",
  },
];

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const marketing = await getMarketingSettings();
  const checkout = params.checkout
    ? await firestoreDb.paymentCheckout.findUnique({
        where: { id: params.checkout },
        include: { plan: true },
      })
    : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_12%_0%,rgba(20,184,166,0.12),transparent_38%),radial-gradient(circle_at_88%_6%,rgba(59,130,246,0.12),transparent_34%),#FCFCFD]">
      <PublicHeader blogUrl={marketing.blogUrl} />
      <main className="pt-32 pb-20 md:pt-36">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-emerald-600">
              Assinatura ativa
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              Pagamento confirmado
            </h1>
            <p className="mt-3 text-neutral-600">
              Tudo certo! Os recursos do plano são liberados assim que o gateway confirma a
              transação — normalmente em poucos segundos.
            </p>
          </div>

          {checkout ? (
            <div className="mx-auto mt-8 max-w-md rounded-3xl border border-black/5 bg-white p-6 shadow-[0_24px_60px_-40px_rgba(16,185,129,0.5)]">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                Resumo da contratação
              </p>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-500">Item</dt>
                  <dd className="font-medium text-neutral-900">
                    {checkout.plan?.name ?? checkout.kind}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-500">Valor</dt>
                  <dd className="font-medium text-neutral-900">
                    {formatPriceCents(checkout.amountCents)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-500">Gateway</dt>
                  <dd className="font-medium capitalize text-neutral-900">{checkout.provider}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {NEXT_STEPS.map((step) => (
              <Link
                key={step.title}
                href={step.href}
                className="group flex flex-col rounded-3xl border border-black/5 bg-white/90 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#14B8A6]/40 hover:shadow-[0_20px_45px_-28px_rgba(20,184,166,0.5)]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#14B8A6]/12 text-[#0F766E]">
                  <step.icon className="h-5 w-5" />
                </span>
                <p className="mt-4 font-semibold text-neutral-900">{step.title}</p>
                <p className="mt-1.5 flex-1 text-sm text-neutral-500">{step.description}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#9333EA]">
                  {step.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/app/meu-plano">
              <Button size="lg">Ver meu plano</Button>
            </Link>
            <Link href="/app">
              <Button size="lg" variant="secondary">
                Ir para o dashboard
              </Button>
            </Link>
          </div>
        </Container>
      </main>
      <PublicFooter blogUrl={marketing.blogUrl} whatsappUrl={marketing.whatsappUrl} />
    </div>
  );
}
