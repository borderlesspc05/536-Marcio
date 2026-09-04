export function getPublicMarketingSettings() {
  return {
    whatsappUrl:
      process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/5500000000000",
    blogUrl:
      process.env.NEXT_PUBLIC_BLOG_URL || "https://blog.cotacondo.com.br",
    supplierVideoUrl: process.env.NEXT_PUBLIC_SUPPLIER_VIDEO_URL || null,
  };
}

export const PUBLIC_LANDING_BANNERS = [
  {
    id: "cotacoes",
    title: "Cotações digitais para condomínios",
    imageUrl: "/brand/banners/01-cotacoes.svg",
    linkUrl: "/cadastro?tipo=sindico",
  },
  {
    id: "fornecedores",
    title: "Fornecedores com compliance",
    imageUrl: "/brand/banners/02-fornecedores.svg",
    linkUrl: "/fornecedores",
  },
  {
    id: "compliance",
    title: "Compras com governança e segurança",
    imageUrl: "/brand/banners/03-compliance.svg",
    linkUrl: "/checkout?plan=adm-premium",
  },
] as const;
