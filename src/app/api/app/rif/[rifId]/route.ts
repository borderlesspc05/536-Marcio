import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { OrganizationType } from "@/lib/domain/types";
import { renderRifHtmlDocument } from "@/features/master-service/rif-html";
import {
  DEFAULT_RIF_BRAND,
  type RifBrand,
  type RifComparativeRow,
  type RifQuotationContext,
} from "@/features/master-service/rif";

type RouteContext = { params: Promise<{ rifId: string }> };

export async function GET(_request: Request, routeContext: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { rifId } = await routeContext.params;
  const rif = await firestoreDb.rifAnalysis.findUnique({
    where: { id: rifId },
    include: {
      quotation: {
        include: {
          organization: true,
          serviceClient: true,
        },
      },
    },
  });
  if (!rif?.quotation) {
    return NextResponse.json({ error: "RIF não encontrado" }, { status: 404 });
  }

  const quotation = rif.quotation;
  const isMasterService =
    session.organizationType === OrganizationType.master_service &&
    quotation.serviceManagedByOrgId === session.organizationId;
  const isOwnerOrg = quotation.organizationId === session.organizationId;
  const isVisibleClient =
    quotation.rifVisibleToClient && isOwnerOrg && rif.status === "published";

  if (!isMasterService && !isVisibleClient) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  let parsed: {
    rows?: RifComparativeRow[];
    plainForWord?: string;
    brand?: RifBrand;
    context?: RifQuotationContext;
  } = {};
  try {
    parsed = JSON.parse(rif.comparativeJson || "{}") as typeof parsed;
  } catch {
    parsed = {};
  }

  const brand = parsed.brand ?? DEFAULT_RIF_BRAND;
  const rifContext: RifQuotationContext = parsed.context ?? {
    publicId: quotation.publicId,
    condominiumName: "—",
    categoryName: "—",
    serviceName: "—",
    description: quotation.description,
    requesterOrgName: quotation.organization.name,
  };
  const rows = parsed.rows ?? [];
  const plainBody = parsed.plainForWord ?? rif.summaryMarkdown;

  const html = renderRifHtmlDocument({
    context: rifContext,
    averageCents: rif.averageCents ?? 0,
    rows,
    brand,
    aiInsights: rif.aiInsights,
    plainBody,
  });

  const fileName = `RIF-${rifContext.publicId.replace(/[^\w.-]+/g, "_")}.html`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
