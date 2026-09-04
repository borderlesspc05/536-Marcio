import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { MemberRole, OrganizationType } from "@/lib/domain/types";
import { firestoreDb } from "@/lib/firebase/firestore-db";

export const SESSION_COOKIE = "cotacondo_session";

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  organizationType: OrganizationType;
  organizationName: string;
  role: MemberRole;
};

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET inválido. Configure no .env");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}

export async function buildSessionForUser(userId: string): Promise<SessionPayload | null> {
  const membership = await firestoreDb.organizationMember.findFirst({
    where: { userId },
    include: {
      user: true,
      organization: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!membership || !membership.user.emailVerifiedAt) {
    return null;
  }

  return {
    userId: membership.user.id,
    email: membership.user.email,
    name: membership.user.name,
    organizationId: membership.organization.id,
    organizationType: membership.organization.type,
    organizationName: membership.organization.name,
    role: membership.role,
  };
}
