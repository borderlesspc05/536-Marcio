import { markOverdueCompliance } from "../src/features/compliance/expire";
import { firestoreDb } from "../src/lib/firebase/firestore-db";



async function main() {
  const count = await markOverdueCompliance();
  console.log(`Compliance expire: ${count} documento(s) → em_atraso`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await firestoreDb.$disconnect();
  });
