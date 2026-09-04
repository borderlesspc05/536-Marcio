import { initializeApp, getApps, cert, type App, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import path from "node:path";

function resolveCredential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json && json !== '""' && json !== "''" && json !== "{}") {
    try {
      const parsed = JSON.parse(json) as ServiceAccount;
      if (parsed && typeof parsed === "object" && "private_key" in parsed) {
        return cert(parsed);
      }
    } catch {
      // Invalid JSON — treat as missing so callers get a clear config error.
    }
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (credentialsPath) {
    const absolute = path.isAbsolute(credentialsPath)
      ? credentialsPath
      : path.resolve(process.cwd(), credentialsPath);
    return cert(absolute);
  }

  return undefined;
}

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(resolveCredential());
}

export function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "marcio-ab7d9";
  const credential = resolveCredential();

  if (credential) {
    return initializeApp({
      credential,
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  // Emuladores locais ou ambientes com ADC (App Hosting / Cloud Run).
  return initializeApp({
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminFirestore() {
  return getFirestore(getFirebaseAdminApp());
}

export function getAdminStorage() {
  return getStorage(getFirebaseAdminApp());
}
