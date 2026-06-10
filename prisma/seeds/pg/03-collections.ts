import { PrismaClient } from '@prisma/client';

export async function seedCollections(prisma: PrismaClient): Promise<Record<string, string>> {
  console.log('  🎁 Seeding collections...');

  const defs = [
    { name: "Valentine's Day", slug: 'valentines-day', occasion: 'valentine',  sortOrder: 1 },
    { name: 'Birthday',        slug: 'birthday',       occasion: 'birthday',   sortOrder: 2 },
    { name: 'Anniversary',     slug: 'anniversary',    occasion: 'anniversary',sortOrder: 3 },
    { name: "Mother's Day",    slug: 'mothers-day',    occasion: 'mothers',    sortOrder: 4 },
    { name: "Father's Day",    slug: 'fathers-day',    occasion: 'fathers',    sortOrder: 5 },
    { name: 'Graduation',      slug: 'graduation',     occasion: 'graduation', sortOrder: 6 },
    { name: 'Christmas',       slug: 'christmas',      occasion: 'christmas',  sortOrder: 7 },
    { name: 'Wedding',         slug: 'wedding',        occasion: 'wedding',    sortOrder: 8 },
    { name: 'New Baby',        slug: 'new-baby',       occasion: 'baby',       sortOrder: 9 },
    { name: 'Retirement',      slug: 'retirement',     occasion: 'retirement', sortOrder: 10 },
  ];

  const ids: Record<string, string> = {};
  for (const def of defs) {
    const col = await prisma.collection.upsert({
      where:  { slug: def.slug },
      update: { occasion: def.occasion },
      create: { ...def, isActive: true },
    });
    ids[def.slug] = col.id;
    console.log(`    ✓ Collection: ${col.name}`);
  }

  return ids;
}
