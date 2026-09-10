import { PublicHeader } from "@/components/marketing/PublicHeader";
import { SupplierHero } from "@/components/marketing/SupplierHero";
import { PlansSection, type PlanCard } from "@/components/marketing/PlansSection";
import { WhatsAppCta } from "@/components/marketing/WhatsAppCta";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { SupplierHowItWorks } from "@/components/marketing/SupplierHowItWorks";
import { BannerCarousel } from "@/components/marketing/BannerCarousel";
import { getPublicMarketingSettings } from "@/features/marketing/public-settings";

const PUBLIC_SUPPLIER_BANNERS = [
  {
    id: "sup-1",
    title: "Receba oportunidades qualificadas",
    imageUrl: "/brand/banners/02-fornecedores.svg",
    linkUrl: "#planos-fornecedor",
    scrollIntervalMs: 5500,
  },
  {
    id: "sup-2",
    title: "Compliance e CRM no mesmo fluxo",
    imageUrl: "/brand/banners/03-compliance.svg",
    linkUrl: "#planos-fornecedor",
    scrollIntervalMs: 5500,
  },
  {
    id: "sup-3",
    title: "Escale com parcerias e planos Premium",
    imageUrl: "/brand/banners/01-cotacoes.svg",
    linkUrl: "#planos-fornecedor",
    scrollIntervalMs: 5500,
  },
];

const DISPLAY: Record<
  string,
  {
    name: string;
    description: string;
    priceCents?: number;
    monthlyQuota: number | null;
    features: string[];
    recommended?: boolean;
    consultPrice?: boolean;
    hideQuota?: boolean;
    ctaLabel?: string;
  }
> = {
  "fornecedor-free": {
    name: "Condo Free",
    description: "Comece a receber oportunidades com franquia inicial.",
    priceCents: 0,
    monthlyQuota: 5,
    features: [
      "5 cotações internas/mês",
      "1 categoria do catálogo",
      "CRM básico de oportunidades",
    ],
  },
  "fornecedor-pro": {
    name: "Condo Basic",
    description: "Mais volume, categorias e elegibilidade a parcerias.",
    priceCents: 14900,
    monthlyQuota: 30,
    features: [
      "CRM completo",
      "30 cotações/mês",
      "3 categorias inclusas",
      "Elegível a parcerias com administradoras",
      "Consulte adicionais de categoria",
    ],
    recommended: true,
  },
  "fornecedor-premium": {
    name: "Condo Premium",
    description: "Escala máxima com categorias amplas e CRM.",
    priceCents: 24900,
    monthlyQuota: 150,
    features: [
      "Até 150 cotações/mês",
      "Até 5 categorias inclusas",
      "CRM avançado",
      "Elegível a parcerias com administradoras",
      "Consulte adicionais de categoria",
    ],
  },
  "fornecedor-vip": {
    name: "Plano VIP",
    description: "Estruture franquia, categorias e ativação sob medida.",
    monthlyQuota: null,
    features: [
      "Franquia e categorias personalizadas",
      "Banner patrocinado",
      "Campanhas de ativação",
      "Atendimento comercial dedicado",
    ],
    consultPrice: true,
    hideQuota: true,
    ctaLabel: "Fale com um consultor",
  },
};

export default function FornecedoresPage() {
  const marketing = getPublicMarketingSettings();
  const planCards: PlanCard[] = [];
  for (const slug of [
    "fornecedor-free",
    "fornecedor-pro",
    "fornecedor-premium",
    "fornecedor-vip",
  ] as const) {
    const display = DISPLAY[slug];
    if (!display) continue;

    planCards.push({
      slug,
      name: display.name,
      description: display.description,
      priceCents: display.priceCents ?? 0,
      isFree: slug === "fornecedor-free",
      monthlyQuota: display.monthlyQuota,
      features: display.features,
      recommended: display.recommended ?? false,
      consultPrice: display.consultPrice,
      hideQuota: display.hideQuota,
      ctaLabel: display.ctaLabel,
      quotaLabel: slug === "fornecedor-vip" ? "Fale com nossa equipe" : undefined,
      ctaHref: slug === "fornecedor-vip" ? marketing.whatsappUrl : undefined,
    });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_80%_8%,rgba(193, 0, 137,0.09),transparent_34%),radial-gradient(circle_at_10%_40%,rgba(0, 170, 179,0.07),transparent_30%),#ffffff]">
      <PublicHeader blogUrl={marketing.blogUrl} />
      <main>
        <BannerCarousel banners={PUBLIC_SUPPLIER_BANNERS} />
        <SupplierHero videoUrl={marketing.supplierVideoUrl} />
        <PlansSection
          id="planos-fornecedor"
          title="Planos para fornecedores"
          subtitle="Free, Basic, Premium e VIP — use as setas do banner para navegar e contrate direto pelo checkout."
          plans={planCards}
          audience="fornecedor"
        />
        <SupplierHowItWorks />
        <WhatsAppCta
          whatsappUrl={marketing.whatsappUrl}
          title="Fale com um consultor"
          description="Aumente seu potencial de vendas, se conecte com administradoras e síndicos de todo o Brasil. Tire suas dúvidas."
        />
      </main>
      <PublicFooter
        blogUrl={marketing.blogUrl}
        whatsappUrl={marketing.whatsappUrl}
        description="Sua empresa amplia oportunidades, se conecta com potenciais clientes e se torna referência."
      />
    </div>
  );
}
