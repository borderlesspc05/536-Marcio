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

  return filtered.slice(0, take).map((item) => ({
    id: item.id,
    title: item.title,
    imageUrl: item.imageUrl,
    linkUrl: item.linkUrl,
    scrollIntervalMs: item.scrollIntervalMs,
  }));
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
