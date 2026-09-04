"use server";

import { revalidatePath } from "next/cache";
import { OrganizationType } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { getSession } from "@/lib/auth/session";
import { toPublicErrorMessage } from "@/lib/errors";
import {
  createCategoryAddonCheckout,
  createPlanCheckout,
  fulfillCheckoutPaid,
  markCheckoutFailed,
} from "@/features/billing/subscriptions";
import { z } from "zod";

export type ActionResult = { ok: boolean; message?: string; checkoutUrl?: string | null };

const startCheckoutSchema = z.object({
  planSlug: z.string().min(1),
});

export async function startPlanCheckoutAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (!session) {
      return { ok: false, message: "Faça login para contratar o plano." };
    }

    const parsed = startCheckoutSchema.safeParse({
      planSlug: formData.get("planSlug"),
    });
    if (!parsed.success) return { ok: false, message: "Plano inválido." };

    const result = await createPlanCheckout({
      organizationId: session.organizationId,
      userId: session.userId,
      planSlug: parsed.data.planSlug,
      kind: "plan",
    });

    revalidatePath("/app/meu-plano");
    if (!result.checkoutUrl) {
      return { ok: true, message: "Plano atualizado." };
    }
    return { ok: true, checkoutUrl: result.checkoutUrl };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

/** Variante para `useActionState`, que expõe o erro na tela em vez de silenciá-lo. */
export async function startPlanCheckoutFormAction(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return startPlanCheckoutAction(formData);
}

export async function confirmSandboxPaymentFormAction(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return confirmSandboxPaymentAction(formData);
}

export async function startCategoryAddonCheckoutFormAction(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return startCategoryAddonCheckoutAction(formData);
}

export async function cancelSandboxPaymentFormAction(
  _state: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return cancelSandboxPaymentAction(formData);
}

export async function confirmSandboxPaymentAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await getSession();
    const checkoutId = String(formData.get("checkoutId") ?? "");
    if (!checkoutId) return { ok: false, message: "Checkout inválido." };

    const checkout = await firestoreDb.paymentCheckout.findUnique({ where: { id: checkoutId } });
    if (!checkout) return { ok: false, message: "Checkout não encontrado." };
    if (session && checkout.organizationId !== session.organizationId) {
      return { ok: false, message: "Checkout de outra organização." };
    }

    await fulfillCheckoutPaid(checkoutId, session?.userId);
    revalidatePath("/app/meu-plano");
    revalidatePath("/app");
    return { ok: true, checkoutUrl: `/checkout/sucesso?checkout=${checkoutId}` };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function cancelSandboxPaymentAction(formData: FormData): Promise<ActionResult> {
  try {
    const checkoutId = String(formData.get("checkoutId") ?? "");
    await markCheckoutFailed(checkoutId, "canceled");
    return { ok: true, checkoutUrl: "/checkout?canceled=1" };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function startCategoryAddonCheckoutAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.fornecedor],
      href: "/app/meu-plano",
    });

    const quantity = Number(formData.get("quantity") ?? 0);
    const categoryIds = formData.getAll("categoryIds").map(String).filter(Boolean);
    const result = await createCategoryAddonCheckout({
      organizationId: session.organizationId,
      userId: session.userId,
      quantity,
      categoryIds,
    });

    return { ok: true, checkoutUrl: result.checkoutUrl };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function requestDowngradeAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, message: "Faça login." };

    const planSlug = String(formData.get("planSlug") ?? "");
    const result = await createPlanCheckout({
      organizationId: session.organizationId,
      userId: session.userId,
      planSlug,
      kind: "plan",
    });

    revalidatePath("/app/meu-plano");
    return {
      ok: true,
      message: "scheduled" in result && result.scheduled
        ? "Downgrade agendado para o fim do ciclo."
        : "Solicitação processada.",
      checkoutUrl: result.checkoutUrl,
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
