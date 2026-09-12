import { OrganizationType } from "@/lib/domain/types";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { BannersAdminClient } from "@/features/marketing/components/BannersAdminClient";

export default async function BannersAdminPage() {
  await requireAuthorizedSession({
    types: [OrganizationType.master_admin],
    href: "/app/plataforma/banners",
  });

  const [banners, settings, users] = await Promise.all([
    firestoreDb.landingBanner.findMany({ orderBy: { sortOrder: "asc" } }),
    firestoreDb.marketingSettings.findUnique({ where: { id: "default" } }),
    firestoreDb.user.findMany({
      select: { id: true, email: true, name: true },
      orderBy: { email: "asc" },
      take: 50,
    }),
  ]);

  return (
    <BannersAdminClient
      banners={banners.map((banner) => ({
        id: banner.id,
        title: banner.title,
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl,
        sortOrder: banner.sortOrder,
        scrollIntervalMs: banner.scrollIntervalMs,
        isActive: banner.isActive,
        showOnLanding: banner.showOnLanding,
        showInApp: banner.showInApp,
        audienceMode: banner.audienceMode,
        targetProfilesJson: banner.targetProfilesJson,
        targetUserIdsJson: banner.targetUserIdsJson,
      }))}
      settings={
        settings
          ? {
              whatsappUrl: settings.whatsappUrl,
              blogUrl: settings.blogUrl,
              pixelScripts: settings.pixelScripts,
              supplierLpHost: settings.supplierLpHost,
              supplierVideoUrl: settings.supplierVideoUrl,
              maxActiveBanners: settings.maxActiveBanners,
            }
          : null
      }
      userIdPlaceholder={users
        .slice(0, 2)
        .map((u) => u.id)
        .join(", ")}
    />
  );
}
