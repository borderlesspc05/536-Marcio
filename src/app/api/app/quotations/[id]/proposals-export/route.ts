import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { OrganizationType } from "@/lib/domain/types";
import { formatPriceCents } from "@/features/billing/money";

type RouteContext = { params: Promise<{ id: string }> };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Pacote HTML com propostas + links de download dos anexos. */
export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await context.params;
  const quotation = await firestoreDb.quotation.findFirst({
    where: { id },
    include: {
      condominium: true,
      category: true,
      serviceItem: true,
      organization: true,
      proposals: {
        include: {
          organization: true,
          conditions: {
            orderBy: { sortOrder: "asc" },
            include: { attachments: true },
          },
        },
      },
    },
  });
  if (!quotation) {
    return NextResponse.json({ error: "Cotação não encontrada" }, { status: 404 });
  }

  const allowed =
    quotation.organizationId === session.organizationId ||
    (session.organizationType === OrganizationType.master_service &&
      quotation.serviceManagedByOrgId === session.organizationId);
  if (!allowed) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const origin = new URL(request.url).origin;

  const blocks = quotation.proposals
    .map((proposal) => {
      const conditions = proposal.conditions
        .map((condition) => {
          const files = condition.attachments
            .map(
              (file) =>
                `<li><a href="${origin}/api/app/files?path=${encodeURIComponent(file.storagePath)}&name=${encodeURIComponent(file.fileName)}">${escapeHtml(file.fileName)}</a> (${Math.round(file.sizeBytes / 1024)} KB)</li>`,
            )
            .join("");
          return `<li>${formatPriceCents(condition.amountCents)} — ${escapeHtml(condition.paymentTerms)}
            ${files ? `<ul>${files}</ul>` : "<p><em>Sem anexo</em></p>"}
          </li>`;
        })
        .join("");
      return `<section style="margin-bottom:20px;padding:12px;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="margin:0 0 8px;font-size:14pt">${escapeHtml(proposal.organization.name)}</h2>
        <p style="margin:0 0 8px;color:#64748b;font-size:10pt">Status: ${escapeHtml(proposal.status)}</p>
        <ul>${conditions || "<li>Sem condições</li>"}</ul>
      </section>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Propostas ${escapeHtml(quotation.publicId)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    body { font-family: Poppins, system-ui, sans-serif; color:#111; background:#fff; margin:24px; }
    h1 { font-size:18pt; }
    a { color:#c10089; }
  </style>
</head>
<body>
  <h1>Propostas — ${escapeHtml(quotation.publicId)}</h1>
  <p>${escapeHtml(quotation.condominium.name)} · ${escapeHtml(quotation.category.name)} · ${escapeHtml(quotation.serviceItem.name)}</p>
  <p><button onclick="window.print()">Imprimir / Salvar PDF</button></p>
  ${blocks || "<p>Nenhuma proposta.</p>"}
  <p style="margin-top:28px;font-size:9pt;color:#64748b">By CotaCondo</p>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // inline: abre no browser com cookies de sessão — links de anexo funcionam
      "Content-Disposition": `inline; filename="Propostas-${quotation.publicId.replace(/[^\w.-]+/g, "_")}.html"`,
      "Cache-Control": "no-store",
    },
  });
}
