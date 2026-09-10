import { AppError } from "@/lib/errors";
import {
  isFirebaseAuthConfigured,
} from "@/lib/firebase/auth-rest";
import {
  buildSessionForUser,
  createSessionToken,
  setSessionCookie,
  type SessionPayload,
} from "@/lib/auth/session";

/**
 * Seam único da Session: prerequisites do stack Auth (Spark).
 * Callers não precisam conhecer Admin vs REST vs JWT.
 */
export async function assertAuthStackReady(): Promise<void> {
  if (!isFirebaseAuthConfigured()) {
    throw new AppError(
      "Firebase Auth não configurado no ambiente (NEXT_PUBLIC_FIREBASE_API_KEY).",
      "AUTH_STACK",
    );
  }
  const { isFirebaseAdminConfigured } = await import("@/lib/firebase/admin");
  if (!isFirebaseAdminConfigured()) {
    throw new AppError(
      "Firebase Admin ausente. No Firebase Console (projeto marcio-ab7d9) → Project settings → Service accounts → Generate new private key, e cole o JSON em FIREBASE_SERVICE_ACCOUNT_JSON (uma linha) ou use GOOGLE_APPLICATION_CREDENTIALS.",
      "AUTH_STACK",
    );
  }
}

/** Emite o cookie JWT da Session a partir de um payload já montado. */
export async function issueSession(payload: SessionPayload): Promise<void> {
  const jwt = await createSessionToken(payload);
  await setSessionCookie(jwt);
}

/** Carrega membership e emite Session; null se e-mail não verificado / sem org. */
export async function issueSessionForUser(userId: string): Promise<SessionPayload | null> {
  const payload = await buildSessionForUser(userId);
  if (!payload) return null;
  await issueSession(payload);
  return payload;
}
