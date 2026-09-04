import { PublicHeader } from "@/components/marketing/PublicHeader";
import { LandingHero } from "@/components/marketing/LandingHero";
import { BannerCarousel } from "@/components/marketing/BannerCarousel";
import { PlansSection, type PlanCard } from "@/components/marketing/PlansSection";
import { WhatsAppCta } from "@/components/marketing/WhatsAppCta";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import {
  getPublicMarketingSettings,
  PUBLIC_LANDING_BANNERS,
} from "@/features/marketing/public-settings";

const FREE_FEATURES = [
  "Até 15 cotações/mês",
  "Comparativo na plataforma",
  "Negociar e aprovar online",
] as const;

const BASIC_FEATURES = [
  "Até 50 cotações/mês",
  "Comparativo na plataforma",
  "Negociar e aprovar online",
  "Whitelabel no comparativo",
  "Consulte Adicionais",
] as const;

const PREMIUM_FEATURES = [
  "Cotações ilimitadas/mês",
  "Comparativo na plataforma",
  "Negociar e aprovar online",
  "Whitelabel no comparativo",
  "Consulte Adicionais",
  "Gestão de Parcerias",
  "SLA de solicitações",
  "Gestão do processo",
] as const;

const SERVICE_FEATURES = [
  "Cotação gerenciada ponta a ponta pela CotaCondo",
  "Portal whitelabel para solicitantes",
  "Análise RIF comparativa sob demanda",
  "Equipe Master Service com pipeline completo",
  "Redução de custo operacional e escala",
] as const;

const DISPLAY: Record<
  string,
  {
    name: string;
    description: string;
    priceCents: number;
    monthlyQuota: number | null;
    features: string[];
  }
> = {
  "sindico-free": {
    name: "Cota Free",
    description: "Até 15 cotações. Ideal para pequenas operações, mas com segurança.",
    priceCents: 0,
    monthlyQuota: 15,
    features: [...FREE_FEATURES],
  },
  "sindico-pago": {
    name: "Cota Basic",
    description: "Escala a operação com os recursos do Free e adicionais.",
    priceCents: 39990,
    monthlyQuota: 50,
    features: [...BASIC_FEATURES],
  },
  "adm-premium": {
    name: "Cota Premium",
    description: "Operação completa de administradora com gestão de ponta a ponta.",
    priceCents: 68990,
    monthlyQuota: null,
    features: [...PREMIUM_FEATURES],
  },
  "cota-service": {
    name: "Cota Service",
    description:
      "Cuidamos de todo o processo de compras da sua administradora de ponta a ponta com inteligência, transparência e gestão.",
    priceCents: 0,
    monthlyQuota: null,
    features: [...SERVICE_FEATURES],
  },
};

function buildCotaServiceWhatsAppUrl(baseUrl: string) {
  const message =
    "Olá! Sou um cliente interessado no plano Cota Service da CotaCondo. Gostaria de falar com um consultor para entender o plano personalizado de cotação gerenciada.";
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("text", message);
    return url.toString();
  } catch {
    return `https://wa.me/5500000000000?text=${encodeURIComponent(message)}`;
  }
}

export default function HomePage() {
  const marketing = getPublicMarketingSettings();
  const serviceWhatsApp = buildCotaServiceWhatsAppUrl(marketing.whatsappUrl);
  const order = ["sindico-free", "sindico-pago", "adm-premium", "cota-service"];
  const planCards: PlanCard[] = order.map((slug) => {
    const display = DISPLAY[slug]!;
    const isService = slug === "cota-service";
    return {
      slug,
      ...display,
      isFree: slug === "sindico-free",
      recommended: slug === "adm-premium",
      ...(isService
        ? {
            consultPrice: true,
            hideQuota: true,
            ctaLabel: "Falar com Consultor",
            ctaHref: serviceWhatsApp,
          }
        : {}),
    };
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_8%,rgba(167,17,95,0.09),transparent_32%),radial-gradient(circle_at_90%_12%,rgba(8,127,140,0.08),transparent_28%),#ffffff]">
      <PublicHeader blogUrl={marketing.blogUrl} />
      <main>
        <LandingHero />
        <BannerCarousel
          banners={PUBLIC_LANDING_BANNERS.map((item) => ({
            id: item.id,
            title: item.title,
            imageUrl: item.imageUrl,
            linkUrl: item.linkUrl,
          }))}
        />
        <PlansSection
          title="Escolha um plano e otimize a sua operação de compras."
          subtitle="Com os planos CotaCondo você ganha tempo, inteligência de dados e mais segurança no processo de compras. Otimize a sua operação!"
          plans={planCards}
          audience="solicitante"
        />
        <WhatsAppCta whatsappUrl={marketing.whatsappUrl} />
      </main>
      <PublicFooter blogUrl={marketing.blogUrl} whatsappUrl={marketing.whatsappUrl} />
    </div>
  );
}
