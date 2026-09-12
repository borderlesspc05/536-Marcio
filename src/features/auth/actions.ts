"use server";

import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { redirect } from "next/navigation";
import { firestoreDb } from "@/lib/firebase/firestore-db";
import { AppError, toPublicErrorMessage } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";
import {
  generateNumericCode,
  generateResetToken,
  hashPassword,
} from "@/lib/auth/password";
import {
  clearSessionCookie,
  type SessionPayload,
} from "@/lib/auth/session";
import {
  assertAuthStackReady,
  issueSession,
  issueSessionForUser,
} from "@/lib/auth/establish-session";
import { verifyPassword } from "@/lib/auth/password";
import { requireAuthorizedSession } from "@/lib/auth/guards";
import {
  firebaseSendPasswordResetEmail,
  firebaseSignInWithPassword,
  firebaseSignUp,
  isFirebaseAuthConfigured,
} from "@/lib/firebase/auth-rest";
import {
  confirmEmailSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/features/auth/schemas";

export type ActionResult = {
  ok: boolean;
  message?: string;
  devCode?: string;
  resetToken?: string;
};

function planSlugForType(type: OrganizationType): string {
  switch (type) {
    case OrganizationType.fornecedor:
      return "fornecedor-free";
    case OrganizationType.administradora:
      return "adm-free";
    case OrganizationType.sindico:
    default:
      return "sindico-free";
  }
}

export async function registerAction(formData: FormData): Promise<ActionResult> {
  try {
    if (!isFirebaseAuthConfigured()) {
      return { ok: false, message: "Firebase Auth não configurado no ambiente." };
    }

    const parsed = registerSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      organizationName: formData.get("organizationName"),
      organizationType: formData.get("organizationType"),
      document: formData.get("document") || undefined,
      privacyAccepted: formData.get("privacyAccepted") === "on" || formData.get("privacyAccepted") === "true",
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const data = parsed.data;
    const email = data.email.toLowerCase();
    const existing = await firestoreDb.user.findUnique({ where: { email } });
    if (existing) {
      return { ok: false, message: "Já existe uma conta com este e-mail." };
    }

    let firebaseUid: string;
    try {
      const firebaseUser = await firebaseSignUp(email, data.password);
      firebaseUid = firebaseUser.localId;
    } catch (error) {
      return { ok: false, message: toPublicErrorMessage(error) };
    }

    const passwordHash = await hashPassword(data.password);
    const organizationType = data.organizationType as OrganizationType;
    const referralCode = String(formData.get("referralCode") || "").trim();
    const referrer = referralCode
      ? await firestoreDb.user.findUnique({ where: { referralCode } })
      : null;

    const user = await firestoreDb.user.create({
      data: {
        name: data.name,
        email,
        passwordHash,
        firebaseUid,
        privacyAcceptedAt: new Date(),
        referredByUserId: referrer?.id ?? null,
        referralCode: `CC-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        consentRecords: {
          create: {
            type: "privacy_policy",
            accepted: true,
          },
        },
        memberships: {
          create: {
            role: MemberRole.master,
            organization: {
              create: {
                name: data.organizationName,
                document: data.document || null,
                type: organizationType,
              },
            },
          },
        },
      },
      include: { memberships: true },
    });

    const organizationId = user.memberships[0]?.organizationId;
    if (organizationId) {
      const plan = await firestoreDb.plan.findUnique({ where: { slug: planSlugForType(organizationType) } });
      if (plan) {
        await firestoreDb.subscription.create({
          data: {
            organizationId,
            planId: plan.id,
            status: "active",
          },
        });
      }
    }

    const code = generateNumericCode(6);
    await firestoreDb.emailToken.create({
      data: {
        userId: user.id,
        code,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "auth.register",
      entityType: "user",
      entityId: user.id,
      metadata: { organizationType, firebaseUid },
    });

    return {
      ok: true,
      message: "Cadastro realizado. Confirme o código enviado ao e-mail.",
      devCode: process.env.NEXT_PUBLIC_APP_ENV !== "production" ? code : undefined,
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function confirmEmailAction(formData: FormData): Promise<ActionResult> {
  try {
    const parsed = confirmEmailSchema.safeParse({
      email: formData.get("email"),
      code: formData.get("code"),
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const email = parsed.data.email.toLowerCase();
    const user = await firestoreDb.user.findUnique({ where: { email } });
    if (!user) {
      return { ok: false, message: "Não foi possível confirmar o cadastro." };
    }

    const token = await firestoreDb.emailToken.findFirst({
      where: {
        userId: user.id,
        code: parsed.data.code,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!token) {
      return { ok: false, message: "Código inválido ou expirado." };
    }

    await firestoreDb.$transaction([
      firestoreDb.emailToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      firestoreDb.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);

    await writeAuditLog({
      userId: user.id,
      action: "auth.email_confirmed",
      entityType: "user",
      entityId: user.id,
    });

    const sessionPayload = await issueSessionForUser(user.id);
    if (sessionPayload) {
      redirect("/app");
    }

    return { ok: true, message: "E-mail confirmado. Faça login." };
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
    // Next.js redirect throws; rethrow digest redirects
    if (typeof error === "object" && error && "digest" in error) {
      throw error;
    }
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

function safeNextPath(value: FormDataEntryValue | null): string {
  const path = String(value ?? "/app");
  if (
    (path.startsWith("/app") || path.startsWith("/checkout")) &&
    !path.startsWith("//") &&
    !path.includes("://")
  ) {
    return path;
  }
  return "/app";
}

async function tryLocalExternalApproverLogin(
  email: string,
  password: string,
): Promise<SessionPayload | null> {
  const user = await firestoreDb.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  const membership = await firestoreDb.organizationMember.findFirst({
    where: { userId: user.id, role: MemberRole.external_approver },
    include: { organization: true },
  });
  if (!membership) return null;

  const scopeCount = await firestoreDb.externalApproverScope.count({
    where: { userId: user.id, organizationId: membership.organizationId },
  });
  if (scopeCount === 0) return null;

  if (!user.emailVerifiedAt) {
    await firestoreDb.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    organizationId: membership.organization.id,
    organizationType: membership.organization.type,
    organizationName: membership.organization.name,
    role: membership.role,
  };
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  try {
    try {
      await assertAuthStackReady();
    } catch (error) {
      return { ok: false, message: toPublicErrorMessage(error) };
    }

    const parsed = loginSchema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const email = parsed.data.email.toLowerCase();

    let firebaseUid: string;
    try {
      const firebaseUser = await firebaseSignInWithPassword(email, parsed.data.password);
      firebaseUid = firebaseUser.localId;
    } catch (error) {
      const localSession = await tryLocalExternalApproverLogin(email, parsed.data.password);
      if (localSession) {
        await issueSession(localSession);
        await writeAuditLog({
          userId: localSession.userId,
          action: "auth.login_success",
          entityType: "user",
          entityId: localSession.userId,
          metadata: { provider: "local", role: "external_approver" },
        });
        redirect(
          localSession.role === MemberRole.external_approver
            ? "/app/aprovador/cotacoes"
            : safeNextPath(formData.get("next")),
        );
      }

      await writeAuditLog({
        action: "auth.login_failed",
        metadata: { emailDomain: email.split("@")[1] ?? "unknown", provider: "firebase" },
      });
      return { ok: false, message: toPublicErrorMessage(error) };
    }

    const user = await firestoreDb.user.findUnique({ where: { email } });
    if (!user) {
      return {
        ok: false,
        message: "Conta autenticada no Firebase, mas sem perfil na plataforma. Contate o suporte.",
      };
    }

    if (user.firebaseUid !== firebaseUid) {
      await firestoreDb.user.update({
        where: { id: user.id },
        data: { firebaseUid },
      });
    }

    if (!user.emailVerifiedAt) {
      return {
        ok: false,
        message: "Confirme seu e-mail antes de acessar. Use a tela de confirmação.",
      };
    }

    const sessionPayload = await issueSessionForUser(user.id);
    if (!sessionPayload) {
      throw new AppError("Conta sem organização vinculada.", "NO_ORG", 400);
    }

    await writeAuditLog({
      userId: user.id,
      action: "auth.login_success",
      entityType: "user",
      entityId: user.id,
      metadata: { provider: "firebase", firebaseUid },
    });

    redirect(
      sessionPayload.role === MemberRole.external_approver
        ? "/app/aprovador/cotacoes"
        : safeNextPath(formData.get("next")),
    );
  } catch (error) {
    if (typeof error === "object" && error && "digest" in error) {
      throw error;
    }
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function logoutAction() {
  const { getSession } = await import("@/lib/auth/session");
  const session = await getSession();
  if (session) {
    await writeAuditLog({
      userId: session.userId,
      action: "auth.logout",
      entityType: "user",
      entityId: session.userId,
    });
  }
  await clearSessionCookie();
  redirect("/acesse");
}

export async function forgotPasswordAction(formData: FormData): Promise<ActionResult> {
  try {
    const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const email = parsed.data.email.toLowerCase();
    const generic = {
      ok: true,
      message: "Se o e-mail existir, enviaremos um link de recuperação.",
    };

    const user = await firestoreDb.user.findUnique({ where: { email } });
    if (!user) {
      return generic;
    }

    const resetToken = generateResetToken();
    await firestoreDb.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });

    try {
      if (isFirebaseAuthConfigured()) {
        await firebaseSendPasswordResetEmail(email);
      }
    } catch {
      // resposta genérica — não vazar existência / erros do provedor
    }

    await writeAuditLog({
      userId: user.id,
      action: "auth.password_reset_requested",
      entityType: "user",
      entityId: user.id,
      metadata: { provider: "firebase+local" },
    });

    return {
      ...generic,
      resetToken: process.env.NEXT_PUBLIC_APP_ENV !== "production" ? resetToken : undefined,
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function resetPasswordAction(formData: FormData): Promise<ActionResult> {
  try {
    const parsed = resetPasswordSchema.safeParse({
      token: formData.get("token"),
      password: formData.get("password"),
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const reset = await firestoreDb.passwordResetToken.findUnique({
      where: { token: parsed.data.token },
      include: { user: true },
    });

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      return { ok: false, message: "Link de recuperação inválido ou expirado." };
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const usedAt = new Date();

    await firestoreDb.$transaction([
      firestoreDb.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      firestoreDb.passwordResetToken.updateMany({
        where: { userId: reset.userId, usedAt: null },
        data: { usedAt },
      }),
    ]);

    try {
      const { isFirebaseAdminConfigured, getAdminAuth } = await import("@/lib/firebase/admin");
      if (isFirebaseAdminConfigured() && reset.user.firebaseUid) {
        await getAdminAuth().updateUser(reset.user.firebaseUid, {
          password: parsed.data.password,
        });
      }
    } catch {
      // Hash local já atualizado; Firebase pode ser sincronizado no próximo login via e-mail OOB
    }

    await writeAuditLog({
      userId: reset.userId,
      action: "auth.password_reset_completed",
      entityType: "user",
      entityId: reset.userId,
    });

    return { ok: true, message: "Senha atualizada. Faça login." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  try {
    const { getSession } = await import("@/lib/auth/session");
    const session = await getSession();
    if (!session) {
      return { ok: false, message: "Faça login para continuar." };
    }

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    if (name.length < 2) {
      return { ok: false, message: "Informe um nome com pelo menos 2 caracteres." };
    }
    if (!email.includes("@")) {
      return { ok: false, message: "Informe um e-mail de acesso válido." };
    }

    const previous = await firestoreDb.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });

    if (previous?.email !== email) {
      const taken = await firestoreDb.user.findUnique({ where: { email } });
      if (taken && taken.id !== session.userId) {
        return { ok: false, message: "Este e-mail já está em uso por outra conta." };
      }
    }

    await firestoreDb.user.update({
      where: { id: session.userId },
      data: {
        name,
        email,
        ...(previous?.email !== email ? { emailVerifiedAt: null } : {}),
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "auth.profile_updated",
      entityType: "user",
      entityId: session.userId,
      metadata: {
        previousName: previous?.name ?? null,
        name,
        previousEmail: previous?.email ?? null,
        email,
      },
    });

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/app/configuracoes");
    revalidatePath("/app");

    return {
      ok: true,
      message:
        previous?.email !== email
          ? "Perfil atualizado. O e-mail foi alterado — confirme o novo endereço se solicitado."
          : "Perfil atualizado.",
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function changePasswordAction(formData: FormData): Promise<ActionResult> {
  try {
    const { getSession } = await import("@/lib/auth/session");
    const session = await getSession();
    if (!session) return { ok: false, message: "Faça login para continuar." };

    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword.length < 6) {
      return { ok: false, message: "A nova senha deve ter pelo menos 6 caracteres." };
    }
    if (newPassword !== confirmPassword) {
      return { ok: false, message: "A confirmação da nova senha não confere." };
    }

    const user = await firestoreDb.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash) {
      return { ok: false, message: "Conta sem senha local. Use a recuperação de senha." };
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return { ok: false, message: "Senha atual incorreta." };

    await firestoreDb.user.update({
      where: { id: session.userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "auth.password_changed",
      entityType: "user",
      entityId: session.userId,
    });

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/app/configuracoes");
    return { ok: true, message: "Senha alterada com sucesso." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function updateOrganizationLogoAction(formData: FormData): Promise<ActionResult> {
  try {
    const { getSession } = await import("@/lib/auth/session");
    const session = await getSession();
    if (!session) return { ok: false, message: "Faça login para continuar." };

    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Selecione uma imagem de logo." };
    }
    if (!file.type.startsWith("image/")) {
      return { ok: false, message: "Envie uma imagem (PNG, JPG ou WEBP)." };
    }
    if (file.size > 2 * 1024 * 1024) {
      return { ok: false, message: "Logo deve ter no máximo 2MB." };
    }

    // Data URL garante exibição mesmo sem bucket Firebase Storage
    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type || "image/png"};base64,${bytes.toString("base64")}`;

    let logoStoragePath: string | null = null;
    try {
      const { storeOrganizationLogo } = await import("@/lib/storage");
      const stored = await storeOrganizationLogo({
        organizationId: session.organizationId,
        file,
      });
      logoStoragePath = stored.storagePath;
    } catch (error) {
      console.warn("[logo] Storage opcional falhou; logo salva só como data URL.", error);
    }

    await firestoreDb.organization.update({
      where: { id: session.organizationId },
      data: {
        logoUrl: dataUrl,
        ...(logoStoragePath ? { logoStoragePath } : {}),
      },
    });

    const linkedClient = await firestoreDb.serviceClient.findFirst({
      where: { clientOrgId: session.organizationId },
    });
    if (linkedClient) {
      await firestoreDb.serviceClient.update({
        where: { id: linkedClient.id },
        data: { logoUrl: dataUrl },
      });
    }

    await writeAuditLog({
      userId: session.userId,
      action: "organization.logo_updated",
      entityType: "organization",
      entityId: session.organizationId,
    });

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/app/configuracoes");
    revalidatePath("/app");
    return { ok: true, message: "Logo atualizada." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function updateOrganizationBrandAction(formData: FormData): Promise<ActionResult> {
  try {
    const { getSession } = await import("@/lib/auth/session");
    const session = await getSession();
    if (!session) return { ok: false, message: "Faça login para continuar." };

    if (
      session.organizationType !== OrganizationType.administradora &&
      session.organizationType !== OrganizationType.sindico
    ) {
      return { ok: false, message: "Paleta disponível apenas para solicitantes." };
    }

    const { can, getPlanGate } = await import("@/features/billing/plan-gate");
    const gate = await getPlanGate(session.organizationId);
    if (!can(gate, "whitelabel") && !can(gate, "rif") && !can(gate, "cotaService")) {
      return { ok: false, message: "Paleta de cores disponível no plano Premium / Cota Service." };
    }

    const primaryColor = String(formData.get("primaryColor") || "").trim();
    const secondaryColor = String(formData.get("secondaryColor") || "").trim();
    const hex = /^#[0-9A-Fa-f]{6}$/;
    if (!hex.test(primaryColor) || !hex.test(secondaryColor)) {
      return { ok: false, message: "Informe cores hexadecimais válidas (#RRGGBB)." };
    }

    await firestoreDb.organization.update({
      where: { id: session.organizationId },
      data: { primaryColor, secondaryColor },
    });

    const linkedClient = await firestoreDb.serviceClient.findFirst({
      where: { clientOrgId: session.organizationId },
    });
    if (linkedClient) {
      await firestoreDb.serviceClient.update({
        where: { id: linkedClient.id },
        data: { primaryColor, secondaryColor },
      });
    }

    await writeAuditLog({
      userId: session.userId,
      action: "organization.brand_updated",
      entityType: "organization",
      entityId: session.organizationId,
      metadata: { primaryColor, secondaryColor },
    });

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/app/configuracoes");
    revalidatePath("/app");
    return { ok: true, message: "Paleta de cores salva." };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function inviteSupplierUserAction(formData: FormData): Promise<ActionResult & { upgradeRequired?: boolean; tempPassword?: string }> {
  try {
    const session = await requireAuthorizedSession({
      types: [OrganizationType.fornecedor],
      roles: [MemberRole.master],
      href: "/app/configuracoes",
    });

    const { getPlanGate } = await import("@/features/billing/plan-gate");
    const gate = await getPlanGate(session.organizationId);
    if (!gate || gate.isFree) {
      return {
        ok: false,
        upgradeRequired: true,
        message: "Cadastrar novos usuários está disponível nos planos pagos. Faça upgrade.",
      };
    }

    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const name = String(formData.get("name") ?? "").trim();
    if (!email.includes("@") || name.length < 2) {
      return { ok: false, message: "Informe nome e e-mail válidos." };
    }

    const { randomBytes } = await import("crypto");
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
          role: MemberRole.operational,
        },
      });
      const { revalidatePath } = await import("next/cache");
      revalidatePath("/app/configuracoes");
      return { ok: true, message: "Usuário vinculado à organização." };
    }

    const tempPassword = `Convite@${randomBytes(3).toString("hex")}`;
    const passwordHash = await hashPassword(tempPassword);
    const created = await firestoreDb.user.create({
      data: {
        email,
        name,
        passwordHash,
        referralCode: `CC-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        memberships: {
          create: {
            organizationId: session.organizationId,
            role: MemberRole.operational,
          },
        },
      },
    });

    await writeAuditLog({
      userId: session.userId,
      action: "team.invited",
      entityType: "user",
      entityId: created.id,
      metadata: { email, organizationType: "fornecedor" },
    });

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/app/configuracoes");
    return {
      ok: true,
      message: "Usuário cadastrado.",
      tempPassword: process.env.NEXT_PUBLIC_APP_ENV !== "production" ? tempPassword : undefined,
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}

export async function resendConfirmationAction(formData: FormData): Promise<ActionResult> {
  try {
    const email = String(formData.get("email") ?? "").toLowerCase();
    if (!email.includes("@")) {
      return { ok: false, message: "E-mail inválido" };
    }

    const user = await firestoreDb.user.findUnique({ where: { email } });
    if (!user) {
      return { ok: true, message: "Se o e-mail existir, enviamos um novo código." };
    }

    if (user.emailVerifiedAt) {
      return { ok: true, message: "Este e-mail já está confirmado. Faça login." };
    }

    const code = generateNumericCode(6);
    await firestoreDb.emailToken.create({
      data: {
        userId: user.id,
        code,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    });

    return {
      ok: true,
      message: "Novo código gerado.",
      devCode: process.env.NEXT_PUBLIC_APP_ENV !== "production" ? code : undefined,
    };
  } catch (error) {
    return { ok: false, message: toPublicErrorMessage(error) };
  }
}
