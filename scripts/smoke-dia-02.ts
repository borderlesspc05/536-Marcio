import { firestoreDb } from "../src/lib/firebase/firestore-db";
import { catalogTotals } from "../src/features/catalog/seed-data";
import {
  createQuotationConsumingFranchise,
  getFranchiseBalance,
} from "../src/features/quotations/franchise";

async function main() {
  const expected = catalogTotals();
  const categories = await firestoreDb.serviceCategory.count({ where: { deletedAt: null } });
  const services = await firestoreDb.serviceItem.count({ where: { deletedAt: null } });
  if (categories !== expected.categories || services !== expected.services) {
    throw new Error(
      `Catálogo inválido: ${categories}/${services}, esperado ${expected.categories}/${expected.services}`,
    );
  }
  console.log(`Catálogo OK: ${categories} categorias / ${services} serviços`);

  const org = await firestoreDb.organization.findFirst({ where: { type: "sindico" } });
  if (!org) throw new Error("Org síndico ausente");
  const user = await firestoreDb.user.findFirst({ where: { email: "sindico@demo.cotacondo.com.br" } });
  if (!user) throw new Error("Usuário síndico ausente");

  const before = await getFranchiseBalance(org.id);
  console.log("Franquia antes:", before);

  const condo = await firestoreDb.condominium.create({
    data: {
      organizationId: org.id,
      name: "Smoke Condo Dia 2",
      address: "Rua Teste 123",
      document: "04252011000110",
    },
  });

  const category = await firestoreDb.serviceCategory.findFirst({
    where: { slug: "seguros", deletedAt: null },
  });
  const service = await firestoreDb.serviceItem.findFirst({
    where: { categoryId: category!.id, slug: "incendio", deletedAt: null },
  });
  if (!category || !service) throw new Error("Categoria/serviço seed ausente");

  const quotation = await createQuotationConsumingFranchise({
    organizationId: org.id,
    condominiumId: condo.id,
    categoryId: category.id,
    serviceItemId: service.id,
    urgency: "media",
    description: "Cotação smoke do Dia 2 com descrição suficiente.",
    minProposals: 3,
    maxProposals: 10,
    createdByUserId: user.id,
    publicId: `COT-SMOKE-${Date.now()}`,
  });

  const after = await getFranchiseBalance(org.id);
  console.log("Franquia depois:", after);
  console.log("Cotação:", quotation.publicId);
  console.log("SMOKE DIA 2 OK");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await firestoreDb.$disconnect();
  });
