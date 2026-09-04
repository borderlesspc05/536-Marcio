import Link from "next/link";
import { Check } from "lucide-react";
import { formatPriceCents } from "@/features/billing/money";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export type PlanCard = {
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  isFree: boolean;
  monthlyQuota: number | null;
  features: string[];
  recommended?: boolean;
  /** CTA especial (ex.: VIP / consultoria) */
  ctaLabel?: string;
  ctaHref?: string;
  hideQuota?: boolean;
  consultPrice?: boolean;
  quotaLabel?: string;
};

type PlansSectionProps = {
  id?: string;
  title: string;
  subtitle: string;
  plans: PlanCard[];
  audience: "solicitante" | "fornecedor";
};

export function PlansSection({ id = "planos", title, subtitle, plans, audience }: PlansSectionProps) {
  const gridCols =
    plans.length >= 4
      ? "lg:grid-cols-2 xl:grid-cols-4"
      : "lg:grid-cols-3";

  return (
    <section id={id} className="py-20 lg:py-24">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#A7115F]">Planos</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0A0A0A] sm:text-4xl">
            {title}
          </h2>
          <p className="mt-3 text-base text-[#6B7280] sm:text-lg">{subtitle}</p>
        </div>

        <div className={`mt-12 grid gap-5 ${gridCols}`}>
          {plans.map((plan) => {
            const href =
              plan.ctaHref ??
              (plan.isFree
                ? `/cadastro?tipo=${audience === "fornecedor" ? "fornecedor" : "sindico"}`
                : `/checkout?plan=${plan.slug}`);

            return (
              <article
                key={plan.slug}
                className={`group relative flex flex-col rounded-2xl border p-6 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 sm:p-7 ${
                  plan.recommended
                    ? "border-[#A7115F]/35 bg-gradient-to-br from-white via-white to-[#FFF1F7] shadow-[0_20px_50px_-24px_rgba(167,17,95,0.38)]"
                    : "border-[#D9E2EC] bg-white/90 shadow-[0_16px_40px_-32px_rgba(16,42,67,0.7)] hover:border-[#A7115F]/20"
                }`}
              >
                {plan.recommended ? (
                  <span className="absolute -top-3 left-6 rounded-full bg-[#A7115F] px-3 py-1 text-[11px] font-semibold text-white">
                    Recomendado
                  </span>
                ) : null}
                <h3 className="text-xl font-bold text-[#0A0A0A]">{plan.name}</h3>
                <p className="mt-2 min-h-[44px] text-sm text-[#6B7280]">
                  {plan.description || "Plano CotaCondo"}
                </p>
                <p className="mt-6 text-4xl font-extrabold tracking-tight text-[#0A0A0A]">
                  {plan.consultPrice ? (
                    <span className="text-2xl sm:text-3xl">Sob consulta</span>
                  ) : (
                    <>
                      {formatPriceCents(plan.priceCents)}
                      {!plan.isFree ? (
                        <span className="text-base font-medium text-[#6B7280]"> /mês</span>
                      ) : null}
                    </>
                  )}
                </p>
                {!plan.hideQuota ? (
                  <p className="mt-2 text-xs text-[#6B7280]">
                    Franquia:{" "}
                    {plan.monthlyQuota == null
                      ? "Ilimitada"
                      : `${plan.monthlyQuota} cotações/mês`}
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-[#526D82]">
                    {plan.quotaLabel ?? "Negócio sob relacionamento"}
                  </p>
                )}
                <p className="mt-5 rounded-xl bg-[#FFF1F7] px-3 py-2 text-center text-xs font-bold text-[#8F0E52]">
                  Sua indicação vale cashback
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-[#171717]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#14B8A6]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href={href} className="mt-8 block" {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
                  <Button
                    className="w-full"
                    variant={plan.recommended ? "primary" : "secondary"}
                  >
                    {plan.ctaLabel ?? (plan.isFree ? "Começar grátis" : "Contratar")}
                  </Button>
                </Link>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
