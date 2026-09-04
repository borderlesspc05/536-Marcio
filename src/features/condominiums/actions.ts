"use server";

import { revalidatePath } from "next/cache";
import { OrganizationType } from "@/lib/domain/types";
import Papa from "papaparse";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import { condominiumSchema } from "@/features/condominiums/schemas";
import { isValidCnpj, onlyDigits } from "@/lib/cnpj";

export type ActionResult = { ok: boolean; message?: string };
export type ImportResult = {
  ok: boolean;
  message?: string;
  created: number;
  errors: Array<{ line: number; message: string }>;
};

const ALLOWED_TYPES = [OrganizationType.sindico, OrganizationType.administradora];
const MAX_IMPORT_ROWS = 500;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

async function requireSolicitante() {
  return requireAuthorizedSession({
    types: ALLOWED_TYPES,
    href: "/app/condominios",
  });
}

export async function createCondominiumAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSolicitante();
    const parsed = condominiumSchema.safeParse({
      name: formData.get("name"),
      address: formData.get("address"),
      document: formData.get("document") || undefined,
      contactName: formData.get("contactName") || undefined,
      contactEmail: formData.get("contactEmail") || undefined,
      contactPhone: formData.get("contactPhone") || undefined,
      towers: formData.get("towers") || undefined,
      units: formData.get("units") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const created = await firestoreDb.condominium.create({
      data: {
        organizationId: session.organizationId,
        name: parsed.data.name,
        address: parsed.data.address,
        document: parsed.data.document || null,
        contactName: parsed.data.contactName || null,
        contactEmail: parsed.data.contactEmail || null,
        contactPhone: parsed.data.contactPhone || null,
        towers: parsed.data.towers ?? null,
        units: parsed.data.units ?? null,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "condominium.created",
      entityType: "condominium",
      entityId: created.id,
    });
    revalidatePath("/app/condominios");
    return { ok: true, message: "Condomínio cadastrado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function updateCondominiumAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSolicitante();
    const id = String(formData.get("id") ?? "");
    const parsed = condominiumSchema.safeParse({
      name: formData.get("name"),
      address: formData.get("address"),
      document: formData.get("document") || undefined,
      contactName: formData.get("contactName") || undefined,
      contactEmail: formData.get("contactEmail") || undefined,
      contactPhone: formData.get("contactPhone") || undefined,
      towers: formData.get("towers") || undefined,
      units: formData.get("units") || undefined,
    });
    if (!id || !parsed.success) {
      return { ok: false, message: "Dados inválidos" };
    }

    const existing = await firestoreDb.condominium.findFirst({
      where: { id, organizationId: session.organizationId, archivedAt: null },
    });
    if (!existing) return { ok: false, message: "Condomínio não encontrado." };

    await firestoreDb.condominium.update({
      where: { id },
      data: {
        name: parsed.data.name,
        address: parsed.data.address,
        document: parsed.data.document || null,
        contactName: parsed.data.contactName || null,
        contactEmail: parsed.data.contactEmail || null,
        contactPhone: parsed.data.contactPhone || null,
        towers: parsed.data.towers ?? null,
        units: parsed.data.units ?? null,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "condominium.updated",
      entityType: "condominium",
      entityId: id,
    });
    revalidatePath("/app/condominios");
    return { ok: true, message: "Condomínio atualizado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function archiveCondominiumAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireSolicitante();
    const id = String(formData.get("id") ?? "");
    const existing = await firestoreDb.condominium.findFirst({
      where: { id, organizationId: session.organizationId, archivedAt: null },
    });
    if (!existing) return { ok: false, message: "Condomínio não encontrado." };

    await firestoreDb.condominium.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "condominium.archived",
      entityType: "condominium",
      entityId: id,
    });
    revalidatePath("/app/condominios");
    return { ok: true, message: "Condomínio arquivado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function importCondominiumsAction(formData: FormData): Promise<ImportResult> {
  try {
    const session = await requireSolicitante();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, message: "Selecione um arquivo CSV.", created: 0, errors: [] };
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return { ok: false, message: "Arquivo excede 2MB.", created: 0, errors: [] };
    }

    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
    });

    if (parsed.data.length > MAX_IMPORT_ROWS) {
      return {
        ok: false,
        message: `Limite de ${MAX_IMPORT_ROWS} linhas por upload.`,
        created: 0,
        errors: [],
      };
    }

    let created = 0;
    const errors: Array<{ line: number; message: string }> = [];

    for (const [index, row] of parsed.data.entries()) {
      const line = index + 2;
      const name = (row.nome || row.name || "").trim();
      const address = (row.endereco || row.address || "").trim();
      const documentRaw = (row.cnpj || row.document || "").trim();
      const contactName = (row.contato || row.contact || row.contactname || "").trim();
      const contactEmail = (row.email || row.contactemail || "").trim();
      const contactPhone = (row.telefone || row.phone || row.contactphone || "").trim();

      if (!name || !address) {
        errors.push({ line, message: "Nome e endereço são obrigatórios." });
        continue;
      }

      const document = documentRaw ? onlyDigits(documentRaw) : undefined;
      if (document && !isValidCnpj(document)) {
        errors.push({ line, message: "CNPJ inválido." });
        continue;
      }

      await firestoreDb.condominium.create({
        data: {
          organizationId: session.organizationId,
          name,
          address,
          document: document || null,
          contactName: contactName || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
        },
      });
      created += 1;
    }

    await writeAuditLog({
      userId: session.userId,
      action: "condominium.imported",
      entityType: "condominium",
      metadata: { created, errors: errors.length },
    });
    revalidatePath("/app/condominios");

    return {
      ok: true,
      message: `Importação concluída: ${created} criados, ${errors.length} com erro.`,
      created,
      errors,
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error), created: 0, errors: [] };
  }
}
