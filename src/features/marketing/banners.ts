import type { BannerAudienceMode, OrganizationType } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";

export type AppBannerSlide = {
  id: string;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
  scrollIntervalMs: number;
};

function parseJsonArray(raw: string | null | undefined): string[] {
  try {
    const value = JSON.parse(raw || "[]") as unknown;
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

export async function getLandingBannersForPublic(): Promise<AppBannerSlide[]> {
  const settings = await firestoreDb.marketingSettings.findUnique({ where: { id: "default" } });
  const take = settings?.maxActiveBanners ?? 10;
  const banners = await firestoreDb.landingBanner.findMany({
    where: { isActive: true, showOnLanding: true },
    orderBy: { sortOrder: "asc" },
    take,
  });
  return banners.map((item) => ({
    id: item.id,
    title: item.title,
    imageUrl: item.imageUrl,
    linkUrl: item.linkUrl,
    scrollIntervalMs: item.scrollIntervalMs,
  }));
}

export async function getAppBannersForSession(input: {
  userId: string;
  organizationType: OrganizationType;
}): Promise<AppBannerSlide[]> {
  const settings = await firestoreDb.marketingSettings.findUnique({ where: { id: "default" } });
  const take = settings?.maxActiveBanners ?? 10;
  const banners = await firestoreDb.landingBanner.findMany({
    where: { isActive: true, showInApp: true },
    orderBy: { sortOrder: "asc" },
    take: 20,
  });

  const filtered = banners.filter((banner) =>
    matchesAudience({
      mode: banner.audienceMode,
      profiles: parseJsonArray(banner.targetProfilesJson),
      userIds: parseJsonArray(banner.targetUserIdsJson),
      userId: input.userId,
      organizationType: input.organizationType,
    }),
  );

  const mapped = filtered.slice(0, take).map((item) => ({
    id: item.id,
    title: item.title,
    imageUrl: item.imageUrl,
    linkUrl: item.linkUrl,
    scrollIntervalMs: item.scrollIntervalMs,
  }));

  // Fallback: se o ambiente não tiver banners seedados, ainda assim mostra slides por perfil.
  if (mapped.length === 0) {
    return defaultAppBanners(input.organizationType);
  }
  return mapped;
}

function defaultAppBanners(organizationType: OrganizationType): AppBannerSlide[] {
  const common = {
    scrollIntervalMs: 5500,
  };
  if (organizationType === "fornecedor") {
    return [
      {
        id: "fallback-sup-1",
        title: "Organize oportunidades no Kanban",
        imageUrl: "/brand/banners/02-fornecedores.svg",
        linkUrl: "/app/oportunidades?view=kanban",
        ...common,
      },
      {
        id: "fallback-sup-2",
        title: "Mantenha o compliance em dia",
        imageUrl: "/brand/banners/03-compliance.svg",
        linkUrl: "/app/compliance",
        ...common,
      },
    ];
  }
  if (organizationType === "administradora") {
    return [
      {
        id: "fallback-adm-1",
        title: "Gestão de equipe e aprovadores",
        imageUrl: "/brand/banners/01-cotacoes.svg",
        linkUrl: "/app/equipe",
        ...common,
      },
      {
        id: "fallback-adm-2",
        title: "Indique e acompanhe cashback",
        imageUrl: "/brand/banners/02-fornecedores.svg",
        linkUrl: "/app/indicacoes",
        ...common,
      },
    ];
  }
  // síndico e demais solicitantes
  return [
    {
      id: "fallback-sin-1",
      title: "Crie uma nova cotação com franquia do plano",
      imageUrl: "/brand/banners/01-cotacoes.svg",
      linkUrl: "/app/cotacoes",
      ...common,
    },
    {
      id: "fallback-sin-2",
      title: "Veja planos e faça upgrade em Meu Plano",
      imageUrl: "/brand/banners/03-compliance.svg",
      linkUrl: "/app/meu-plano",
      ...common,
    },
    {
      id: "fallback-sin-3",
      title: "Indique colegas e acompanhe o status",
      imageUrl: "/brand/banners/02-fornecedores.svg",
      linkUrl: "/app/indicacoes",
      ...common,
    },
  ];
}

export function matchesAudience(input: {
  mode: BannerAudienceMode;
  profiles: string[];
  userIds: string[];
  userId: string;
  organizationType: OrganizationType;
}): boolean {
  if (input.mode === "all") return true;
  if (input.mode === "profiles") {
    return input.profiles.includes(input.organizationType);
  }
  if (input.mode === "users") {
    return input.userIds.includes(input.userId);
  }
  return true;
}
