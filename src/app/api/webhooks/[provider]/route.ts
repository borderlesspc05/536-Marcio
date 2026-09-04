import { NextResponse } from "next/server";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { getPaymentProvider } from "@/features/billing/payment-provider";
import {
  fulfillCheckoutPaid,
  markCheckoutFailed,
} from "@/features/billing/subscriptions";
import { writeAuditLog } from "@/lib/audit";

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: providerParam } = await context.params;
  const provider = getPaymentProvider();
  if (providerParam !== provider.name && providerParam !== "sandbox") {
    return NextResponse.json({ ok: false, message: "Provider inválido" }, { status: 400 });
  }

  const signature =
    provider.name === "asaas"
      ? request.headers.get("asaas-access-token")
      : request.headers.get("x-webhook-signature");
  const expected = process.env.PAYMENT_WEBHOOK_SECRET;
  if (provider.name === "sandbox" && expected && signature !== expected) {
    return NextResponse.json({ ok: false, message: "Assinatura inválida" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = provider.parseWebhook(payload, signature);
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Webhook inválido" },
      { status: 400 },
    );
  }

  const existing = await firestoreDb.paymentWebhookEvent.findUnique({
    where: {
      provider_eventId: { provider: provider.name, eventId: parsed.eventId },
    },
  });
  if (existing?.processedAt) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  const event = existing
    ? existing
    : await firestoreDb.paymentWebhookEvent.create({
        data: {
          provider: provider.name,
          eventId: parsed.eventId,
          eventType: parsed.eventType,
          payloadJson: JSON.stringify(parsed.raw),
        },
      });

  const checkout = await firestoreDb.paymentCheckout.findFirst({
    where: { externalId: parsed.externalCheckoutId },
  });
  if (!checkout) {
    return NextResponse.json({ ok: false, message: "Checkout não encontrado" }, { status: 404 });
  }

  if (parsed.status === "paid") {
    await fulfillCheckoutPaid(checkout.id);
  } else if (parsed.status !== "pending") {
    await markCheckoutFailed(checkout.id, parsed.status);
  }

  await firestoreDb.paymentWebhookEvent.update({
    where: { id: event.id },
    data: { processedAt: new Date() },
  });

  await writeAuditLog({
    action: "payment.webhook_processed",
    entityType: "payment_checkout",
    entityId: checkout.id,
    metadata: { eventId: parsed.eventId, status: parsed.status },
  });

  return NextResponse.json({ ok: true });
}
