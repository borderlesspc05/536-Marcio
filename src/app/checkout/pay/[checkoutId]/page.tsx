import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, LayoutDashboard, Receipt } from "lucide-react";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { formatPriceCents } from "@/features/billing/plan-gate";
import { getMarketingSettings } from "@/features/marketing/data";
import {
  cancelSandboxPaymentFormAction,
  confirmSandboxPaymentFormAction,
} from "@/features/billing/actions";
import { ActionForm } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PublicHeader } from "@/components/marketing/PublicHeader";
import { PublicFooter } from "@/components/marketing/PublicFooter";

type PageProps = { params: Promise<{ checkoutId: string }> };

function checkoutItemLabel(checkout: {
  kind: string;
  quantity: number;
  metadataJson: string | null;
  plan: { name: string } | null;
}) {
  if (checkout.plan?.name) return checkout.plan.name;
  if (checkout.kind === "category_addon") {
    return `Categorias adicionais × ${checkout.quantity}`;
  }
  if (checkout.kind === "custom") {
    try {
      const meta = JSON.parse(checkout.metadataJson || "{}") as { description?: string };
      return meta.description || "Cobrança personalizada";
    } catch {
      return "Cobrança personalizada";
    }
  }
  return checkout.kind;
}

export default async function SandboxPayPage({ params }: PageProps) {
  const { checkoutId } = await params;
  const [checkout, marketing] = await Promise.all([
    firestoreDb.paymentCheckout.findUnique({
      where: { id: checkoutId },
      include: { plan: true },
    }),
    getMarketingSettings(),
  ]);
  if (!checkout) notFound();

  if (checkout.status === "paid") {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_12%_0%,rgba(20,184,166,0.12),transparent_38%),radial-gradient(circle_at_88%_6%,rgba(59,130,246,0.12),transparent_34%),#FCFCFD]">
        <PublicHeader blogUrl={marketing.blogUrl} />
        <main className="pt-32 pb-20 md:pt-36">
          <Container>
            <div className="mx-auto max-w-lg text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-emerald-600">
                Pagamento já registrado
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
                Este checkout já foi pago
              </h1>
              <p className="mt-3 text-neutral-600">
                A cobrança foi confirmada e o plano já está ativo na sua organização.
                Não é necessário pagar de novo.
              </p>
            </div>

            <div className="mx-auto mt-8 max-w-md rounded-3xl border border-black/5 bg-white p-6 shadow-[0_24px_60px_-40px_rgba(16,185,129,0.5)]">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                Resumo da contratação
              </p>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-500">Item</dt>
                  <dd className="font-medium text-neutral-900">{checkoutItemLabel(checkout)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-500">Valor</dt>
                  <dd className="font-medium text-neutral-900">
                    {formatPriceCents(checkout.amountCents)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-500">Status</dt>
                  <dd className="font-semibold text-emerald-700">Pago</dd>
                </div>
              </dl>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={`/checkout/sucesso?checkout=${checkout.id}`}>
                <Button size="lg" className="gap-2">
                  <Receipt className="h-4 w-4" />
                  Ver comprovante
                </Button>
              </Link>
              <Link href="/app/meu-plano">
                <Button size="lg" variant="secondary" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Ir para meu plano
                </Button>
              </Link>
            </div>
          </Container>
        </main>
        <PublicFooter blogUrl={marketing.blogUrl} whatsappUrl={marketing.whatsappUrl} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <Container className="py-16">
        <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-neutral-900 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Gateway Sandbox
          </p>
          <h1 className="mt-3 text-2xl font-bold">Confirmar pagamento</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Simulação de Stripe/Asaas/Pagar.me — nenhum cartão real é cobrado.
          </p>
          <div className="mt-6 space-y-2 rounded-2xl bg-white/5 p-4 text-sm">
            <p>
              <span className="text-neutral-400">Item:</span> {checkoutItemLabel(checkout)}
            </p>
            <p>
              <span className="text-neutral-400">Valor:</span>{" "}
              {formatPriceCents(checkout.amountCents)}
            </p>
            <p>
              <span className="text-neutral-400">Provider:</span> {checkout.provider}
            </p>
            <p className="break-all text-xs text-neutral-500">ID: {checkout.externalId}</p>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <ActionForm
              action={confirmSandboxPaymentFormAction}
              submitLabel="Confirmar pagamento (sandbox)"
              pendingLabel="Confirmando..."
            >
              <input type="hidden" name="checkoutId" value={checkout.id} />
            </ActionForm>
            <ActionForm
              action={cancelSandboxPaymentFormAction}
              variant="secondary"
              submitLabel="Cancelar"
              pendingLabel="Cancelando..."
            >
              <input type="hidden" name="checkoutId" value={checkout.id} />
            </ActionForm>
          </div>
        </div>
      </Container>
    </div>
  );
}
