import { firestoreDb } from "../src/lib/firebase/firestore-db";
import { evaluatePriceAgainstAverage } from "../src/features/opportunities/analysis";
import { getSupplierPlanInfo } from "../src/features/supplier/franchise";
import { runDistributionEngine } from "../src/features/distribution/engine";

async function main() {
  const evalOk = evaluatePriceAgainstAverage(11000, [10000, 10000, 10000]);
  if (!evalOk || evalOk.position !== "acima") {
    throw new Error(`Avaliar preço falhou: ${JSON.stringify(evalOk)}`);
  }
  console.log(`Avaliar preço OK: +${evalOk.percentDelta}%`);

  const fornecedor = await firestoreDb.organization.findFirst({ where: { type: "fornecedor" } });
  if (!fornecedor) throw new Error("Fornecedor demo ausente");

  // Backfill segmentos se legado sem serviceItemId
  const links = await firestoreDb.organizationCategory.findMany({
    where: { organizationId: fornecedor.id },
  });
  for (const link of links) {
    if (!link.serviceItemId) {
      const first = await firestoreDb.serviceItem.findFirst({
        where: { categoryId: link.categoryId, deletedAt: null },
        orderBy: { sortOrder: "asc" },
      });
      if (first) {
        await firestoreDb.organizationCategory.update({
          where: { id: link.id },
          data: { serviceItemId: first.id },
        });
      }
    }
  }

  const plan = await getSupplierPlanInfo(fornecedor.id);
  if (plan.segmentsIncluded < 1) throw new Error("segmentsIncluded inválido");
  console.log(
    `Plano fornecedor OK: cats=${plan.categoriesIncluded} segs=${plan.segmentsIncluded} links=${plan.links.length}`,
  );

  const quotation = await firestoreDb.quotation.findFirst({
    where: { status: { in: ["aberta", "em_negociacao"] } },
    include: { invites: true },
  });
  if (quotation) {
    const result = await runDistributionEngine(quotation.id);
    console.log(
      `Distribuição match segmento: invited=${result.invited.length} skipped=${result.skipped.length}`,
    );
  }

  const org = await firestoreDb.organization.update({
    where: { id: fornecedor.id },
    data: {
      googleProfileUrl: "https://maps.google.com/?q=cotacondo-demo",
      reclameAquiUrl: "https://www.reclameaqui.com.br/empresa/cotacondo-demo/",
    },
  });
  if (!org.googleProfileUrl) throw new Error("Reputação não gravou");
  console.log("Reputação Google/Reclame Aqui OK");

  const banner = await firestoreDb.landingBanner.findFirst();
  if (banner) {
    await firestoreDb.landingBanner.update({
      where: { id: banner.id },
      data: { scrollIntervalMs: 4000 },
    });
    console.log("Banner scrollIntervalMs OK");
  }

  console.log("SMOKE CLIENTE FEEDBACK OK");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await firestoreDb.$disconnect();
  });
