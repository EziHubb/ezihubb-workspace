import { PrismaClient } from '@prisma/client';

function slug(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

type UpsertArgs = { name: string; s?: string; level: number; parentId?: string; sortOrder?: number; description?: string };

async function upsertCategory(prisma: PrismaClient, args: UpsertArgs) {
  const { name, s, level, parentId, sortOrder = 0, description } = args;
  const sl = s ?? slug(name);
  return prisma.category.upsert({
    where:  { slug: sl },
    update: { level, ...(parentId ? { parentId } : {}), sortOrder },
    create: { name, slug: sl, level, parentId: parentId ?? null, sortOrder, description },
  });
}

async function seedL3Items(prisma: PrismaClient, parentId: string, names: string[]) {
  for (let i = 0; i < names.length; i++) {
    await upsertCategory(prisma, { name: names[i], level: 3, parentId, sortOrder: i + 1 });
  }
}

export async function seedCategories(prisma: PrismaClient) {
  console.log('  📂 Seeding categories...');

  // ── L1 Nav tabs ──────────────────────────────────────────────────────────────
  const L1 = {
    gifts:        await upsertCategory(prisma, { name: 'Gifts',          level: 1, sortOrder: 1 }),
    homeLiving:   await upsertCategory(prisma, { name: 'Home & Living',  s: 'home-living',   level: 1, sortOrder: 2 }),
    drinkBarware: await upsertCategory(prisma, { name: 'Drink & Barware', s: 'drink-barware', level: 1, sortOrder: 3 }),
    apparel:      await upsertCategory(prisma, { name: 'Apparel',        level: 1, sortOrder: 4 }),
    accessories:  await upsertCategory(prisma, { name: 'Accessories',    level: 1, sortOrder: 5 }),
    interests:    await upsertCategory(prisma, { name: 'Interests',      level: 1, sortOrder: 6 }),
  };
  for (const v of Object.values(L1)) console.log(`    ✓ L1: ${v.name}`);

  // ── L2 Groups ─────────────────────────────────────────────────────────────────
  const homeLivingGroups = {
    bedBath:             await upsertCategory(prisma, { name: 'Bed & Bath',           s: 'bed-bath',            level: 2, parentId: L1.homeLiving.id,   sortOrder: 1 }),
    christmasOrnaments:  await upsertCategory(prisma, { name: 'Christmas Ornaments',  s: 'christmas-ornaments', level: 2, parentId: L1.homeLiving.id,   sortOrder: 2 }),
    floorRugs:           await upsertCategory(prisma, { name: 'Floor & Rugs',         s: 'floor-rugs',          level: 2, parentId: L1.homeLiving.id,   sortOrder: 3 }),
    framesDisplays:      await upsertCategory(prisma, { name: 'Frames and Displays',  s: 'frames-displays',     level: 2, parentId: L1.homeLiving.id,   sortOrder: 4 }),
    hangingDecoration:   await upsertCategory(prisma, { name: 'Hanging Decoration',   s: 'hanging-decoration',  level: 2, parentId: L1.homeLiving.id,   sortOrder: 5 }),
    jewelryStorage:      await upsertCategory(prisma, { name: 'Jewelry Storage',      s: 'jewelry-storage',     level: 2, parentId: L1.homeLiving.id,   sortOrder: 6 }),
    kitchenDining:       await upsertCategory(prisma, { name: 'Kitchen & Dining',     s: 'kitchen-dining',      level: 2, parentId: L1.homeLiving.id,   sortOrder: 7 }),
    lighting:            await upsertCategory(prisma, { name: 'Lighting',                                       level: 2, parentId: L1.homeLiving.id,   sortOrder: 8 }),
    outdoorGardening:    await upsertCategory(prisma, { name: 'Outdoor & Gardening',  s: 'outdoor-gardening',   level: 2, parentId: L1.homeLiving.id,   sortOrder: 9 }),
    wallDecor:           await upsertCategory(prisma, { name: 'Wall Decor',           s: 'wall-decor',          level: 2, parentId: L1.homeLiving.id,   sortOrder: 10 }),
  };

  const drinkGroups = {
    mugs:        await upsertCategory(prisma, { name: 'Mugs',             s: 'mugs',         level: 2, parentId: L1.drinkBarware.id, sortOrder: 1 }),
    tumblers:    await upsertCategory(prisma, { name: 'Tumblers',         s: 'tumblers',     level: 2, parentId: L1.drinkBarware.id, sortOrder: 2 }),
    glasses:     await upsertCategory(prisma, { name: 'Glasses',          s: 'glasses',      level: 2, parentId: L1.drinkBarware.id, sortOrder: 3 }),
    coastersBar: await upsertCategory(prisma, { name: 'Coasters & Bar',   s: 'coasters-bar', level: 2, parentId: L1.drinkBarware.id, sortOrder: 4 }),
  };

  const apparelGroups = {
    tshirtsTops: await upsertCategory(prisma, { name: 'T-Shirts & Tops', s: 't-shirts-tops', level: 2, parentId: L1.apparel.id, sortOrder: 1 }),
    outerwear:   await upsertCategory(prisma, { name: 'Outerwear',                            level: 2, parentId: L1.apparel.id, sortOrder: 2 }),
    kidsBaby:    await upsertCategory(prisma, { name: 'Kids & Baby',      s: 'kids-baby',     level: 2, parentId: L1.apparel.id, sortOrder: 3 }),
  };

  const accessoriesGroups = {
    bagsTotes:       await upsertCategory(prisma, { name: 'Bags & Totes',      s: 'bags-totes',       level: 2, parentId: L1.accessories.id, sortOrder: 1 }),
    jewelry:         await upsertCategory(prisma, { name: 'Jewelry',                                   level: 2, parentId: L1.accessories.id, sortOrder: 2 }),
    techAccessories: await upsertCategory(prisma, { name: 'Tech Accessories',  s: 'tech-accessories', level: 2, parentId: L1.accessories.id, sortOrder: 3 }),
  };

  const giftsGroups = {
    forHer:  await upsertCategory(prisma, { name: 'For Her',  s: 'for-her',  level: 2, parentId: L1.gifts.id, sortOrder: 1 }),
    forHim:  await upsertCategory(prisma, { name: 'For Him',  s: 'for-him',  level: 2, parentId: L1.gifts.id, sortOrder: 2 }),
    forKids: await upsertCategory(prisma, { name: 'For Kids', s: 'for-kids', level: 2, parentId: L1.gifts.id, sortOrder: 3 }),
    forPets: await upsertCategory(prisma, { name: 'For Pets', s: 'for-pets', level: 2, parentId: L1.gifts.id, sortOrder: 4 }),
  };
  console.log('    ✓ L2 groups created');

  // ── L3 Leaf items ──────────────────────────────────────────────────────────────

  // Bed & Bath
  await seedL3Items(prisma, homeLivingGroups.bedBath.id, ['Blankets','Laundry Storage Basket','Pillows','Quilt Sets','Wearable Blanket Hoodies']);
  await upsertCategory(prisma, { name: 'Throw Pillows',  s: 'throw-pillows',  level: 3, parentId: homeLivingGroups.bedBath.id, sortOrder: 6 });

  // Christmas Ornaments
  await upsertCategory(prisma, { name: 'Acrylic Ornaments',    s: 'acrylic-ornaments',    level: 3, parentId: homeLivingGroups.christmasOrnaments.id, sortOrder: 1 });
  await upsertCategory(prisma, { name: 'Aluminum Ornaments',   s: 'aluminum-ornaments',   level: 3, parentId: homeLivingGroups.christmasOrnaments.id, sortOrder: 2 });
  await upsertCategory(prisma, { name: 'Ceramic Ornaments',    s: 'ceramic-ornaments',    level: 3, parentId: homeLivingGroups.christmasOrnaments.id, sortOrder: 3 });
  await upsertCategory(prisma, { name: 'Glass Ornaments',      s: 'glass-ornaments',      level: 3, parentId: homeLivingGroups.christmasOrnaments.id, sortOrder: 4 });
  await upsertCategory(prisma, { name: 'Suncatcher Ornaments', s: 'suncatcher-ornaments', level: 3, parentId: homeLivingGroups.christmasOrnaments.id, sortOrder: 5 });
  await upsertCategory(prisma, { name: 'Wooden Ornaments',     s: 'wooden-ornaments',     level: 3, parentId: homeLivingGroups.christmasOrnaments.id, sortOrder: 6 });
  await upsertCategory(prisma, { name: 'Photo Ornaments',      s: 'ornaments',            level: 3, parentId: homeLivingGroups.christmasOrnaments.id, sortOrder: 7 });

  // Floor & Rugs
  await seedL3Items(prisma, homeLivingGroups.floorRugs.id, ['Christmas Tree Skirts','Doormats','Runner Rugs']);

  // Frames & Displays — includes 'acrylic-plaques'
  await seedL3Items(prisma, homeLivingGroups.framesDisplays.id, ['Acrylic Plaques','Acrylic Desk Clocks','Ceramic Flower Vases','Ceramic Plates','Family Puzzles']);

  // Hanging Decoration
  await seedL3Items(prisma, homeLivingGroups.hangingDecoration.id, ['Magnets','Suncatchers','Wine Bottle Wind Chimes','Wood Signs']);

  // Jewelry Storage
  await seedL3Items(prisma, homeLivingGroups.jewelryStorage.id, ['Jewelry Dishes','Jewelry Boxes','Leather Valet Trays','Makeup Boxes With LED Mirror']);

  // Kitchen & Dining — includes 'cutting-boards'
  await seedL3Items(prisma, homeLivingGroups.kitchenDining.id, ['Cookie Jars','Cutting Boards','Oven Mitts And Pot Holders','Platters','Tea And Biscuit Boards']);

  // Lighting
  await seedL3Items(prisma, homeLivingGroups.lighting.id, ['Bottle Lamps','Fabric Lamps','LED Candles','LED Night Light','Mason Jar Lights','Vintage Lantern Night Lights']);

  // Outdoor & Gardening
  await seedL3Items(prisma, homeLivingGroups.outdoorGardening.id, ['Ceramic Plant Pots','Door Corner Wood Signs','Garden Stakes','Indoor Watering Cans','Metal Signs','Solar Lights','Wind Chimes']);

  // Wall Decor — 'canvas' and 'wood-acrylic-art'
  await upsertCategory(prisma, { name: 'Posters / Canvas',        s: 'canvas',          level: 3, parentId: homeLivingGroups.wallDecor.id, sortOrder: 1 });
  await upsertCategory(prisma, { name: 'Key Holders',             s: 'key-holders',     level: 3, parentId: homeLivingGroups.wallDecor.id, sortOrder: 2 });
  await upsertCategory(prisma, { name: 'Wood And Acrylic Wall Art', s: 'wood-acrylic-art', level: 3, parentId: homeLivingGroups.wallDecor.id, sortOrder: 3 });

  // Drink — 'coffee-mugs', 'stainless-steel-tumblers', 'wine-glasses'
  await seedL3Items(prisma, drinkGroups.mugs.id,     ['Coffee Mugs','Photo Mugs','Travel Mugs','Enamel Mugs']);
  await seedL3Items(prisma, drinkGroups.tumblers.id, ['Stainless Steel Tumblers','Glass Tumblers','Sports Bottles']);
  await seedL3Items(prisma, drinkGroups.glasses.id,  ['Wine Glasses','Beer Glasses','Champagne Flutes','Shot Glasses']);
  await seedL3Items(prisma, drinkGroups.coastersBar.id, ['Coaster Sets','Bottle Openers','Wine Racks','Beer Steins']);

  // Apparel — 'classic-tees', 'hoodies', 'onesies'
  await seedL3Items(prisma, apparelGroups.tshirtsTops.id, ['Classic Tees','V-Neck Tees','Long Sleeve Shirts','Tank Tops']);
  await upsertCategory(prisma, { name: 'Hoodies',        s: 'hoodies',        level: 3, parentId: apparelGroups.outerwear.id, sortOrder: 1 });
  await upsertCategory(prisma, { name: 'Zip-Up Hoodies', s: 'zip-hoodies',    level: 3, parentId: apparelGroups.outerwear.id, sortOrder: 2 });
  await upsertCategory(prisma, { name: 'Sweatshirts',    s: 'sweatshirts',    level: 3, parentId: apparelGroups.outerwear.id, sortOrder: 3 });
  await upsertCategory(prisma, { name: 'Bomber Jackets', s: 'bomber-jackets', level: 3, parentId: apparelGroups.outerwear.id, sortOrder: 4 });
  await seedL3Items(prisma, apparelGroups.kidsBaby.id, ['Onesies','Kids T-Shirts','Baby Bibs','Baby Blankets']);

  // Accessories — 'tote-bags', 'keychains', 'phone-cases'
  await seedL3Items(prisma, accessoriesGroups.bagsTotes.id,       ['Tote Bags','Backpacks','Drawstring Bags','Fanny Packs']);
  await seedL3Items(prisma, accessoriesGroups.jewelry.id,         ['Necklaces','Bracelets','Keychains','Rings']);
  await seedL3Items(prisma, accessoriesGroups.techAccessories.id, ['Phone Cases','Mouse Pads','Laptop Sleeves','AirPod Cases']);

  // Gifts
  await seedL3Items(prisma, giftsGroups.forHer.id,  ['Jewelry And Accessories','Home Decor','Beauty And Wellness']);
  await seedL3Items(prisma, giftsGroups.forHim.id,  ['Drinkware','Tech Accessories','Outdoor']);
  await seedL3Items(prisma, giftsGroups.forKids.id, ['Toys And Games','Clothing','Room Decor']);
  await seedL3Items(prisma, giftsGroups.forPets.id, ['Pet Portraits','Pet Tags','Pet Clothing']);

  console.log('    ✓ L3 leaf items created');
  return { L1, homeLivingGroups, drinkGroups, apparelGroups, accessoriesGroups, giftsGroups };
}
