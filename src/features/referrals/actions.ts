"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import { toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";

export type ActionResult = { ok: boolean; message?: string; code?: string };

function makeReferralCode() {
  return `CC-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function ensureReferralCodeAction(): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.administradora, OrganizationType.sindico, OrganizationType.fornecedor],
      href: "/app/indicacoes",
    });

    const user = await firestoreDb.user.findUniqueOrThrow({ where: { id: session.userId } });
    if (user.referralCode) {
      return { ok: true, code: user.referralCode, message: "Código já existia." };
    }

    let code = makeReferralCode();
    for (let i = 0; i < 5; i += 1) {
      const exists = await firestoreDb.user.findUnique({ where: { referralCode: code } });
      if (!exists) break;
      code = makeReferralCode();
    }

    await firestoreDb.user.update({
      where: { id: session.userId },
      data: { referralCode: code },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "referral.code_created",
      entityType: "user",
      entityId: session.userId,
      metadata: { code },
    });

    revalidatePath("/app/indicacoes");
    return { ok: true, code, message: "Código gerado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function inviteTeamMemberAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.administradora],
      roles: [MemberRole.master],
      href: "/app/equipe",
    });

    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const name = String(formData.get("name") ?? "").trim();
    const role = String(formData.get("role") ?? "operational");
    if (!email.includes("@") || name.length < 2) {
      return { ok: false, message: "Informe nome e e-mail válidos." };
    }
    if (!["master", "operational"].includes(role)) {
      return { ok: false, message: "Papel inválido." };
    }

    const existing = await firestoreDb.user.findUnique({ where: { email } });
    if (existing) {
      const already = await firestoreDb.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: existing.id,
            organizationId: session.organizationId,
          },
        },
      });
      if (already) return { ok: false, message: "Usuário já está na organização." };

      await firestoreDb.organizationMember.create({
        data: {
          userId: existing.id,
          organizationId: session.organizationId,
          role: role as MemberRole,
        },
      });
    } else {
      // Convite stub: cria usuário pendente de confirmação com senha temporária
      const { hashPassword } = await import("@/lib/auth/password");
      const tempPassword = `Convite@${randomBytes(3).toString("hex")}`;
      const passwordHash = await hashPassword(tempPassword);
      const referrer = await firestoreDb.user.findUnique({ where: { id: session.userId } });

      const created = await firestoreDb.user.create({
        data: {
          email,
          name,
          passwordHash,
          referredByUserId: session.userId,
          referralCode: makeReferralCode(),
          memberships: {
            create: {
              organizationId: session.organizationId,
              role: role as MemberRole,
            },
          },
        },
      });

      const code = await firestoreDb.emailToken.create({
        data: {
          userId: created.id,
          code: String(Math.floor(100000 + Math.random() * 900000)),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        },
      });

      await writeAuditLog({
        userId: session.userId,
        action: "team.invited",
        entityType: "user",
        entityId: created.id,
        metadata: {
          email,
          role,
          tempPasswordDev: process.env.NEXT_PUBLIC_APP_ENV !== "production" ? tempPassword : undefined,
          confirmCodeDev: process.env.NEXT_PUBLIC_APP_ENV !== "production" ? code.code : undefined,
          referrerCode: referrer?.referralCode,
        },
      });

      revalidatePath("/app/equipe");
      revalidatePath("/app/indicacoes");
      return {
        ok: true,
        message:
          process.env.NEXT_PUBLIC_APP_ENV !== "production"
            ? `Convite criado. Senha temp: ${tempPassword} · código: ${code.code}`
            : "Convite criado. O usuário receberá as instruções de acesso.",
      };
    }

    revalidatePath("/app/equipe");
    return { ok: true, message: "Usuário vinculado à organização." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function updateTeamMemberAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.administradora],
      roles: [MemberRole.master],
      href: "/app/equipe",
    });

    const membershipId = String(formData.get("membershipId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const role = String(formData.get("role") ?? "operational");
    if (!membershipId || name.length < 2 || !email.includes("@")) {
      return { ok: false, message: "Dados inválidos." };
    }
    if (!["master", "operational"].includes(role)) {
      return { ok: false, message: "Papel inválido para usuário interno." };
    }

    const membership = await firestoreDb.organizationMember.findFirst({
      where: { id: membershipId, organizationId: session.organizationId },
      include: { user: true },
    });
    if (!membership) return { ok: false, message: "Usuário não encontrado." };
    if (membership.role === MemberRole.external_approver) {
      return { ok: false, message: "Edite aprovadores externos na seção específica." };
    }

    if (membership.user.email !== email) {
      const taken = await firestoreDb.user.findUnique({ where: { email } });
      if (taken && taken.id !== membership.userId) {
        return { ok: false, message: "E-mail já em uso." };
      }
    }

    await firestoreDb.user.update({
      where: { id: membership.userId },
      data: { name, email },
    });
    await firestoreDb.organizationMember.update({
      where: { id: membership.id },
      data: { role: role as MemberRole },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "team.member_updated",
      entityType: "user",
      entityId: membership.userId,
      metadata: { role, email },
    });

    revalidatePath("/app/equipe");
    return { ok: true, message: "Usuário atualizado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function resendTeamMemberAccessAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.administradora],
      roles: [MemberRole.master],
      href: "/app/equipe",
    });

    const membershipId = String(formData.get("membershipId") ?? "").trim();
    const membership = await firestoreDb.organizationMember.findFirst({
      where: { id: membershipId, organizationId: session.organizationId },
      include: { user: true },
    });
    if (!membership) return { ok: false, message: "Usuário não encontrado." };

    const { hashPassword } = await import("@/lib/auth/password");
    const tempPassword = `Convite@${randomBytes(3).toString("hex")}`;
    await firestoreDb.user.update({
      where: { id: membership.userId },
      data: { passwordHash: await hashPassword(tempPassword) },
    });

    const { sendTemplatedEmail } = await import("@/features/notifications/email-provider");
    await sendTemplatedEmail({
      toEmail: membership.user.email,
      subject: "CotaCondo — reenvio de acesso",
      bodyText: [
        `Olá ${membership.user.name},`,
        "",
        "Seu acesso à organização foi reenviado.",
        `E-mail: ${membership.user.email}`,
        `Senha temporária: ${tempPassword}`,
        "Acesse /acesse para entrar.",
      ].join("\n"),
      template: "team_access_resend",
      metadata: { userId: membership.userId, organizationId: session.organizationId },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "team.access_resent",
      entityType: "user",
      entityId: membership.userId,
    });

    revalidatePath("/app/equipe");
    return {
      ok: true,
      message:
        process.env.NEXT_PUBLIC_APP_ENV !== "production"
          ? `Acesso reenviado. Senha temp: ${tempPassword}`
          : "Acesso reenviado por e-mail.",
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function removeTeamMemberAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.administradora],
      roles: [MemberRole.master],
      href: "/app/equipe",
    });

    const membershipId = String(formData.get("membershipId") ?? "").trim();
    const membership = await firestoreDb.organizationMember.findFirst({
      where: { id: membershipId, organizationId: session.organizationId },
    });
    if (!membership) return { ok: false, message: "Usuário não encontrado." };
    if (membership.userId === session.userId) {
      return { ok: false, message: "Você não pode remover a si mesmo." };
    }
    if (membership.role === MemberRole.external_approver) {
      return { ok: false, message: "Use a exclusão de aprovador externo." };
    }

    if (membership.role === MemberRole.master) {
      const masters = await firestoreDb.organizationMember.count({
        where: {
          organizationId: session.organizationId,
          role: MemberRole.master,
        },
      });
      if (masters <= 1) {
        return { ok: false, message: "Não é possível remover o último Master." };
      }
    }

    await firestoreDb.organizationMember.delete({ where: { id: membership.id } });
    await writeAuditLog({
      userId: session.userId,
      action: "team.member_removed",
      entityType: "user",
      entityId: membership.userId,
    });

    revalidatePath("/app/equipe");
    return { ok: true, message: "Usuário removido da organização." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function registerReferralRewardAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.administradora, OrganizationType.sindico, OrganizationType.fornecedor],
      href: "/app/indicacoes",
    });

    if (
      session.organizationType === OrganizationType.administradora &&
      session.role !== MemberRole.master
    ) {
      return { ok: false, message: "Apenas Master da Adm registra ganhos manuais." };
    }

    const referredUserId = String(formData.get("referredUserId") ?? "");
    const kind = String(formData.get("kind") ?? "recurring_credit");
    const amountCents = Math.round(Number(formData.get("amount")) * 100);
    if (!referredUserId || !Number.isFinite(amountCents)) {
      return { ok: false, message: "Dados inválidos." };
    }

    const referred = await firestoreDb.user.findFirst({
      where: { id: referredUserId, referredByUserId: session.userId },
    });
    if (!referred) return { ok: false, message: "Indicado inválido." };

    await firestoreDb.referralReward.create({
      data: {
        referrerUserId: session.userId,
        referredUserId,
        kind: kind as "recurring_credit" | "discount" | "commission_share",
        amountCents,
        notes: String(formData.get("notes") || "") || null,
        yearMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
      },
    });

    revalidatePath("/app/indicacoes");
    return { ok: true, message: "Ganho/abatimento registrado." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
