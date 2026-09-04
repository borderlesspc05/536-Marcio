/**
 * Garante usuários demo no Firebase Auth (e-mail/senha) com senha padrão 123456.
 * Rode: npx tsx scripts/seed-firebase-auth.ts
 */
import {
  firebaseSignInWithPassword,
  firebaseSignUp,
  firebaseUpdatePassword,
} from "../src/lib/firebase/auth-rest";
import { firestoreDb } from "../src/lib/firebase/firestore-db";

const DEMO_PASSWORD = "123456";
const LEGACY_PASSWORD = "Demo@123456";

const DEMO_USERS = [
  "admin@cotacondo.com.br",
  "masterservice@demo.cotacondo.com.br",
  "sindico@demo.cotacondo.com.br",
  "fornecedor@demo.cotacondo.com.br",
  "adm.master@demo.cotacondo.com.br",
  "adm.operacional@demo.cotacondo.com.br",
  "aprovador@demo.cotacondo.com.br",
] as const;

async function ensureFirebaseUser(email: string): Promise<string> {
  try {
    const created = await firebaseSignUp(email, DEMO_PASSWORD);
    console.log(`  + criado: ${email}`);
    return created.localId;
  } catch (error) {
    const code = (error as Error & { firebaseCode?: string }).firebaseCode ?? "";
    if (!code.includes("EMAIL_EXISTS")) {
      throw error;
    }
  }

  try {
    const signed = await firebaseSignInWithPassword(email, DEMO_PASSWORD);
    console.log(`  = já existia (senha 123456): ${email}`);
    return signed.localId;
  } catch {
    // tenta senha legada e atualiza
  }

  try {
    const legacy = await firebaseSignInWithPassword(email, LEGACY_PASSWORD);
    const updated = await firebaseUpdatePassword(legacy.idToken, DEMO_PASSWORD);
    console.log(`  ~ senha atualizada para 123456: ${email}`);
    return updated.localId;
  } catch (error) {
    console.error(`  ! não foi possível sincronizar ${email}:`, error);
    throw error;
  }
}

async function main() {
  console.log("Sincronizando usuários demo no Firebase Auth…");
  for (const email of DEMO_USERS) {
    const uid = await ensureFirebaseUser(email);
    await firestoreDb.user.updateMany({
      where: { email },
      data: {
        firebaseUid: uid,
        emailVerifiedAt: new Date(),
      },
    });
  }
  console.log("Firebase Auth demo OK. Senha padrão: 123456");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await firestoreDb.$disconnect();
  });
