"use server";

import {
  AppointmentLeadMode,
  AppointmentSource,
  MemberRole,
  OrganizationType,
} from "@/lib/domain/types";
import { revalidatePath } from "next/cache";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { writeAuditLog } from "@/lib/audit";
import { getRequestIp } from "@/lib/request-ip";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";
import { getExternalApproverCondominiumIds } from "@/features/external-approver/guards";
import { parseBrDate } from "@/features/appointments/filters";

export type ActionResult = { ok: boolean; message?: string };

function parseLeadMode(formData: FormData): {
  leadMode: AppointmentLeadMode;
  leadExactDate: Date | null;
} {
  const leadModeRaw = String(formData.get("leadMode") || "days_30");
  if (leadModeRaw === "exact_date") {
    const raw = String(formData.get("leadExactDate") || formData.get("appointmentDate") || "").trim();
    const iso = raw ? new Date(raw) : null;
    const br = raw ? parseBrDate(raw) : null;
    const leadExactDate = iso && !Number.isNaN(iso.getTime()) ? iso : br;
    return { leadMode: AppointmentLeadMode.exact_date, leadExactDate };
  }
  const leadMode = leadModeRaw as AppointmentLeadMode;
  return { leadMode, leadExactDate: null };
}

async function assertCanManageCondominium(input: {
  userId: string;
  organizationId: string;
  organizationType: OrganizationType;
  role: MemberRole;
  condominiumId: string;
}) {
  if (input.role === MemberRole.external_approver) {
    const ids = await getExternalApproverCondominiumIds(input.userId, input.organizationId);
    if (!ids.includes(input.condominiumId)) {
      throw new Error("Sem permissão para este condomínio.");
    }
    return;
  }

  if (input.organizationType === OrganizationType.master_service) {
    const condo = await firestoreDb.condominium.findFirst({
      where: {
        id: input.condominiumId,
        organization: {
          serviceClientProfile: { managedByOrgId: input.organizationId },
        },
      },
    });
    if (!condo) throw new Error("Condomínio não encontrado.");
    return;
  }

  const condo = await firestoreDb.condominium.findFirst({
    where: { id: input.condominiumId, organizationId: input.organizationId },
  });
  if (!condo) throw new Error("Condomínio não encontrado.");
}

export async function createServiceAppointmentAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession();
    const condominiumId = String(formData.get("condominiumId") || "").trim();
    const categoryId = String(formData.get("categoryId") || "").trim();
    const serviceItemId = String(formData.get("serviceItemId") || "").trim() || null;
    const appointmentRaw = String(formData.get("appointmentDate") || "").trim();
    const notes = String(formData.get("notes") || "").trim() || null;

    const appointmentDate =
      parseBrDate(appointmentRaw) ??
      (appointmentRaw ? new Date(appointmentRaw) : null);
    if (!appointmentDate || Number.isNaN(appointmentDate.getTime())) {
      return { ok: false, message: "Informe a data do compromisso." };
    }

    await assertCanManageCondominium({
      userId: session.userId,
      organizationId: session.organizationId,
      organizationType: session.organizationType,
      role: session.role,
      condominiumId,
    });

    const condo = await firestoreDb.condominium.findUniqueOrThrow({
      where: { id: condominiumId },
      include: { organization: { include: { serviceClientProfile: true } } },
    });

    const { leadMode, leadExactDate } = parseLeadMode(formData);
    const ip = await getRequestIp();

    const appointment = await firestoreDb.serviceAppointment.create({
      data: {
        organizationId: condo.organizationId,
        serviceClientId: condo.organization.serviceClientProfile?.id ?? null,
        condominiumId,
        categoryId,
        serviceItemId,
        appointmentDate,
        leadMode,
        leadExactDate,
        source: AppointmentSource.manual,
        createdByUserId: session.userId,
        notes,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "appointment.created",
      entityType: "ServiceAppointment",
      entityId: appointment.id,
      ip,
      metadata: { condominiumId, categoryId, appointmentDate: appointmentDate.toISOString() },
    });

    revalidateCalendarPaths(session);
    return { ok: true, message: "Compromisso registrado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function updateServiceAppointmentAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession();
    const id = String(formData.get("id") || "").trim();
    const appointmentRaw = String(formData.get("appointmentDate") || "").trim();
    const notes = String(formData.get("notes") || "").trim() || null;

    const existing = await firestoreDb.serviceAppointment.findUnique({ where: { id } });
    if (!existing) return { ok: false, message: "Compromisso não encontrado." };

    await assertCanManageCondominium({
      userId: session.userId,
      organizationId: session.organizationId,
      organizationType: session.organizationType,
      role: session.role,
      condominiumId: existing.condominiumId,
    });

    const appointmentDate =
      parseBrDate(appointmentRaw) ??
      (appointmentRaw ? new Date(appointmentRaw) : existing.appointmentDate);
    const { leadMode, leadExactDate } = parseLeadMode(formData);
    const ip = await getRequestIp();

    await firestoreDb.serviceAppointment.update({
      where: { id },
      data: {
        appointmentDate,
        leadMode,
        leadExactDate,
        notes,
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "appointment.updated",
      entityType: "ServiceAppointment",
      entityId: id,
      ip,
    });

    revalidateCalendarPaths(session);
    return { ok: true, message: "Compromisso atualizado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function deleteServiceAppointmentAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession();
    const id = String(formData.get("id") || "").trim();

    const existing = await firestoreDb.serviceAppointment.findUnique({ where: { id } });
    if (!existing) return { ok: false, message: "Compromisso não encontrado." };

    await assertCanManageCondominium({
      userId: session.userId,
      organizationId: session.organizationId,
      organizationType: session.organizationType,
      role: session.role,
      condominiumId: existing.condominiumId,
    });

    const ip = await getRequestIp();
    await firestoreDb.serviceAppointment.delete({ where: { id } });

    await writeAuditLog({
      userId: session.userId,
      action: "appointment.deleted",
      entityType: "ServiceAppointment",
      entityId: id,
      ip,
    });

    revalidateCalendarPaths(session);
    return { ok: true, message: "Compromisso excluído." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

function revalidateCalendarPaths(session: {
  role: MemberRole;
  organizationType: OrganizationType;
}) {
  revalidatePath("/app/calendario");
  revalidatePath("/app/service/calendario");
  if (session.role === MemberRole.external_approver) {
    revalidatePath("/app/aprovador/calendario");
  }
}
