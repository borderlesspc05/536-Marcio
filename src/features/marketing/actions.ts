"use server";

import { revalidatePath } from "next/cache";
import { OrganizationType } from "@/lib/domain/types";
import { z } from "zod";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";

export type ActionResult = { ok: boolean; message?: string };

const bannerSchema = z.object({
  title: z.string().min(2).max(120),
  imageUrl: z.string().min(1),
  linkUrl: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).max(99),
  scrollIntervalMs: z.coerce.number().int().min(2000).max(60000),
  isActive: z.boolean(),
  showOnLanding: z.boolean(),
  showInApp: z.boolean(),
  audienceMode: z.enum(["all", "profiles", "users"]),
  targetProfiles: z.array(z.string()).optional(),
  targetUserIds: z.string().optional(),
});

export async function upsertBannerAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAuthorizedSession({
      types: [OrganizationType.master_admin],
      href: "/app/plataforma/banners",
    });

    const id = String(formData.get("id") || "") || undefined;
    const settings = await firestoreDb.marketingSettings.findUnique({ where: { id: "default" } });
    const maxActive = settings?.maxActiveBanners ?? 10;
    const activeCount = await firestoreDb.landingBanner.count({ where: { isActive: true } });
    const profiles = formData.getAll("targetProfiles").map(String).filter(Boolean);
    const parsed = bannerSchema.safeParse({
      title: formData.get("title"),
      imageUrl: formData.get("imageUrl"),
      linkUrl: String(formData.get("linkUrl") || "") || undefined,
      sortOrder: formData.get("sortOrder") || 0,
      scrollIntervalMs: formData.get("scrollIntervalMs") || 5500,
      isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
      showOnLanding:
        formData.get("showOnLanding") === "on" || formData.get("showOnLanding") === "true",
      showInApp: formData.get("showInApp") === "on" || formData.get("showInApp") === "true",
      audienceMode: formData.get("audienceMode") || "all",
      targetProfiles: profiles,
      targetUserIds: String(formData.get("targetUserIds") || ""),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    if (!id && parsed.data.isActive && activeCount >= maxActive) {
      return { ok: false, message: `Máximo de ${maxActive} banners ativos.` };
    }

    const userIds = parsed.data.targetUserIds
      ? parsed.data.targetUserIds
          .split(/[,\s]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    const data = {
      title: parsed.data.title,
      imageUrl: parsed.data.imageUrl,
      linkUrl: parsed.data.linkUrl || null,
      sortOrder: parsed.data.sortOrder,
      scrollIntervalMs: parsed.data.scrollIntervalMs,
      isActive: parsed.data.isActive,
      showOnLanding: parsed.data.showOnLanding,
      showInApp: parsed.data.showInApp,
      audienceMode: parsed.data.audienceMode,
      targetProfilesJson: JSON.stringify(parsed.data.targetProfiles ?? []),
      targetUserIdsJson: JSON.stringify(userIds),
    };

    if (id) {
      await firestoreDb.landingBanner.update({ where: { id }, data });
    } else {
      await firestoreDb.landingBanner.create({ data });
    }

    revalidatePath("/");
    revalidatePath("/app");
    revalidatePath("/app/plataforma/banners");
    return { ok: true, message: "Banner salvo." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function deleteBannerAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAuthorizedSession({
      types: [OrganizationType.master_admin],
      href: "/app/plataforma/banners",
    });
    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, message: "Banner inválido." };
    await firestoreDb.landingBanner.delete({ where: { id } });
    revalidatePath("/");
    revalidatePath("/app");
    revalidatePath("/app/plataforma/banners");
    return { ok: true, message: "Banner removido." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function updateMarketingLinksAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireAuthorizedSession({
      types: [OrganizationType.master_admin],
      href: "/app/plataforma/banners",
    });

    const whatsappUrl = String(formData.get("whatsappUrl") ?? "").trim() || null;
    const blogUrl = String(formData.get("blogUrl") ?? "").trim() || null;
    const pixelScripts = String(formData.get("pixelScripts") ?? "").trim() || null;
    const supplierLpHost = String(formData.get("supplierLpHost") ?? "").trim() || null;
    const supplierVideoUrl = String(formData.get("supplierVideoUrl") ?? "").trim() || null;
    if (
      supplierVideoUrl &&
      !/^https:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(supplierVideoUrl)
    ) {
      return { ok: false, message: "Informe uma URL válida do YouTube para o vídeo de fornecedores." };
    }
    const maxActiveBanners = Math.min(
      20,
      Math.max(1, Number(formData.get("maxActiveBanners") || 10)),
    );

    await firestoreDb.marketingSettings.upsert({
      where: { id: "default" },
      update: {
        whatsappUrl,
        blogUrl,
        pixelScripts,
        supplierLpHost,
        supplierVideoUrl,
        maxActiveBanners,
      },
      create: {
        id: "default",
        whatsappUrl,
        blogUrl,
        pixelScripts,
        supplierLpHost,
        supplierVideoUrl,
        maxActiveBanners,
      },
    });

    revalidatePath("/");
    revalidatePath("/fornecedores");
    revalidatePath("/app/plataforma/banners");
    return { ok: true, message: "Links atualizados." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
