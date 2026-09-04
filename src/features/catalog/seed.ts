import { firestoreDb } from "@/lib/firebase/firestore-db";
import { CATALOG_SEED, itemSlug, catalogTotals } from "@/features/catalog/seed-data";

export async function seedOfficialCatalog() {
  let categoryCount = 0;
  let itemCount = 0;

  for (const [categoryIndex, category] of CATALOG_SEED.entries()) {
    const saved = await firestoreDb.serviceCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        colorToken: category.colorToken,
        sortOrder: categoryIndex + 1,
        isActive: true,
        deletedAt: null,
      },
      create: {
        name: category.name,
        slug: category.slug,
        colorToken: category.colorToken,
        sortOrder: categoryIndex + 1,
        isActive: true,
      },
    });
    categoryCount += 1;

    for (const [itemIndex, item] of category.items.entries()) {
      const slug = itemSlug(item.name);
      await firestoreDb.serviceItem.upsert({
        where: {
          categoryId_slug: {
            categoryId: saved.id,
            slug,
          },
        },
        update: {
          name: item.name,
          isMandatory: Boolean(item.isMandatory),
          periodicityHint: item.periodicityHint ?? null,
          sortOrder: itemIndex + 1,
          isActive: true,
          deletedAt: null,
        },
        create: {
          categoryId: saved.id,
          name: item.name,
          slug,
          isMandatory: Boolean(item.isMandatory),
          periodicityHint: item.periodicityHint ?? null,
          sortOrder: itemIndex + 1,
          isActive: true,
        },
      });
      itemCount += 1;
    }
  }

  const expected = catalogTotals();
  return { categoryCount, itemCount, expected };
}
