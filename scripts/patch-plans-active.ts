/**
 * Patch: marca todos os planos com isActive=true (corrige Meu Plano vazio).
 * Uso: GOOGLE_APPLICATION_CREDENTIALS=... npx tsx scripts/patch-plans-active.ts
 */
import { firestoreDb } from "../src/lib/firebase/firestore-db";

async function main() {
  const plans = await firestoreDb.plan.findMany({});
  console.log(`Encontrados ${plans.length} planos`);
  for (const plan of plans) {
    await firestoreDb.plan.update({
      where: { id: plan.id },
      data: { isActive: true },
    });
    console.log(`OK ${plan.slug}`);
  }
  const check = await firestoreDb.plan.findMany({
    where: { slug: { in: ["sindico-free", "sindico-pago"] }, isActive: true },
  });
  console.log(
    "Síndico ativos:",
    check.map((p: { slug: string; name: string }) => `${p.slug}=${p.name}`).join(", "),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
