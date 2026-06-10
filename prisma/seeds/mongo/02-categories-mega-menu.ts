import { PrismaClient } from '@prisma/client';
import { CategoryMenuModel } from '../shared/mongo-schemas';

const NAV_TABS = [
  { navSlug: 'gifts',         sortOrder: 1, isVisible: true  },
  { navSlug: 'home-living',   sortOrder: 2, isVisible: true  },
  { navSlug: 'drink-barware', sortOrder: 3, isVisible: true  },
  { navSlug: 'apparel',       sortOrder: 4, isVisible: true  },
  { navSlug: 'accessories',   sortOrder: 5, isVisible: true  },
  { navSlug: 'interests',     sortOrder: 7, isVisible: false },
];

export async function seedCategoriesMegaMenu(prisma: PrismaClient) {
  console.log('  🗂️  Seeding MongoDB mega-menu documents...');

  for (const { navSlug, sortOrder, isVisible } of NAV_TABS) {
    const l1 = await prisma.category.findUnique({
      where:   { slug: navSlug },
      include: {
        children: {
          where:   { level: 2 },
          orderBy: { sortOrder: 'asc' },
          include: {
            children: { where: { level: 3 }, orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });

    if (!l1) {
      console.warn(`    ⚠  Category '${navSlug}' not found — skipping`);
      continue;
    }

    await CategoryMenuModel.findOneAndUpdate(
      { navSlug },
      {
        navLabel:   l1.name,
        navSlug,
        categoryId: l1.id,
        sortOrder,
        isVisible,
        groups: l1.children.map((g, gi) => ({
          title:      g.name,
          categoryId: g.id,
          slug:       g.slug,
          sortOrder:  gi,
          items: g.children.map((item, ii) => ({
            name:       item.name,
            categoryId: item.id,
            slug:       item.slug,
            sortOrder:  ii,
          })),
        })),
      },
      { upsert: true, returnDocument: 'after' },
    );

    console.log(`    ✓ Mega-menu: ${l1.name} (${l1.children.length} groups)`);
  }
}
