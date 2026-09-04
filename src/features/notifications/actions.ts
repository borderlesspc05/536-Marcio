"use server";

import { revalidatePath } from "next/cache";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";

export type ActionResult = { ok: boolean; message?: string };

export async function markNotificationReadAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({ href: "/app/notificacoes" });
    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, message: "Notificação inválida." };

    const item = await firestoreDb.notification.findFirst({
      where: { id, userId: session.userId },
    });
    if (!item) return { ok: false, message: "Notificação não encontrada." };

    if (!item.readAt) {
      await firestoreDb.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    }

    revalidatePath("/app");
    revalidatePath("/app/notificacoes");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({ href: "/app/notificacoes" });
    await firestoreDb.notification.updateMany({
      where: { userId: session.userId, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath("/app");
    revalidatePath("/app/notificacoes");
    return { ok: true, message: "Todas marcadas como lidas." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
