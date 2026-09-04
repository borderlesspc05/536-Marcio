"use server";

import { MemberRole } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { toPublicErrorMessage } from "@/lib/errors";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { getServiceClientBySlug } from "@/features/external-approver/data";

export type ActionResult = { ok: boolean; message?: string };

export async function serviceClientLoginAction(formData: FormData): Promise<ActionResult> {
  try {
    const slug = String(formData.get("slug") || "").trim();
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") || "");

    const serviceClient = await getServiceClientBySlug(slug);
    if (!serviceClient) {
      return { ok: false, message: "Portal indisponível." };
    }

    const user = await firestoreDb.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return { ok: false, message: "Credenciais inválidas." };
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return { ok: false, message: "Credenciais inválidas." };
    }

    const membership = await firestoreDb.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: serviceClient.clientOrgId,
        },
      },
      include: { organization: true },
    });

    if (!membership || membership.role !== MemberRole.external_approver) {
      return { ok: false, message: "Usuário sem perfil de aprovador externo neste portal." };
    }

    const scopeCount = await firestoreDb.externalApproverScope.count({
      where: {
        userId: user.id,
        organizationId: serviceClient.clientOrgId,
        serviceClientId: serviceClient.id,
      },
    });
    if (scopeCount === 0) {
      return { ok: false, message: "Sem condomínios vinculados a este portal." };
    }

    if (!user.emailVerifiedAt) {
      await firestoreDb.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      organizationId: membership.organization.id,
      organizationType: membership.organization.type,
      organizationName: membership.organization.name,
      role: membership.role,
    });
    await setSessionCookie(token);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
