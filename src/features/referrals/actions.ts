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
