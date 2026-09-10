import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readStoredFile } from "@/lib/storage";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { OrganizationType } from "@/lib/domain/types";

/** Download autenticado de anexo (proposta/cotação) por storagePath. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const storagePath = url.searchParams.get("path");
  const preferredName = url.searchParams.get("name");
  if (!storagePath) {
    return NextResponse.json({ error: "path obrigatório" }, { status: 400 });
  }

  // Autorização leve: o path deve pertencer a org da sessão ou a cotação service gerenciada.
  const isLocalOrGs = storagePath.startsWith("local://") || storagePath.startsWith("gs://");
  if (!isLocalOrGs) {
    return NextResponse.json({ error: "path inválido" }, { status: 400 });
  }

  const attachment =
    (await firestoreDb.proposalConditionAttachment.findFirst({
      where: { storagePath },
      include: {
        condition: {
          include: {
            proposal: {
              include: { quotation: true },
            },
          },
        },
      },
    })) ?? null;

  const quotationAttachment = attachment
    ? null
    : await firestoreDb.quotationAttachment.findFirst({
        where: { storagePath },
        include: { quotation: true },
      });

  if (!attachment && !quotationAttachment) {
    return NextResponse.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  const quotation = attachment
    ? attachment.condition.proposal.quotation
    : quotationAttachment!.quotation;

  const supplierOwns =
    Boolean(attachment) &&
    session.organizationType === OrganizationType.fornecedor &&
    attachment!.condition.proposal.organizationId === session.organizationId;

  const allowed =
    supplierOwns ||
    quotation.organizationId === session.organizationId ||
    (session.organizationType === OrganizationType.master_service &&
      quotation.serviceManagedByOrgId === session.organizationId);

  if (!allowed) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  try {
    const file = await readStoredFile(storagePath);
    const fileName = preferredName || file.fileName;
    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao ler arquivo" },
      { status: 500 },
    );
  }
}
