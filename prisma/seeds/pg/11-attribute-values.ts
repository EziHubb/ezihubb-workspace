import { PrismaClient } from '@prisma/client';

export async function seedAttributeValues(prisma: PrismaClient) {
  console.log('  🎨 Seeding attribute values...');

  const rows = [
    ...['Red','Blue','Green','Black','White','Yellow','Orange','Purple','Pink',
        'Brown','Gray','Gold','Silver','Beige','Teal','Navy','Khaki','Olive',
        'Turquoise','Lavender','Coral','Cream','Charcoal','Rose Gold',
      ].map(v => ({ type: 'color', value: v })),

    ...['Cotton','Polyester','Ceramic','Bamboo','Stainless Steel','Canvas',
        'Acrylic','Wood','Leather','Linen','Velvet','Nylon','Wool','Glass',
        'Porcelain','Resin','Felt','Faux Leather','Silk','Stone',
      ].map(v => ({ type: 'material', value: v })),

    ...['Birthday','Anniversary','Wedding','Graduation','Christmas',
        "Mother's Day","Father's Day","Valentine's Day",'Baby Shower',
        'Housewarming','Retirement','Get Well','Thank You','Friendship',
        'Easter','Halloween','New Year','Celebration','Just Because',
      ].map(v => ({ type: 'occasion', value: v })),

    ...['Christmas','Easter','Halloween','Hanukkah',"Mother's Day",
        "Father's Day",'New Year',"St. Patrick's Day",'Thanksgiving',
        "Valentine's Day",
      ].map(v => ({ type: 'holiday', value: v })),

    ...['Her','Him','Kids','Baby','Pet Owners','Teachers','Grandparents',
        'Best Friend','Couple','Dad','Mom','Sister','Brother','Wife','Husband',
        'Teen','Men','Women',
      ].map(v => ({ type: 'recipient', value: v })),

    ...['Minimalist','Bohemian','Vintage','Modern','Rustic','Farmhouse',
        'Classic','Retro','Scandinavian','Abstract','Kawaii','Gothic',
        'Industrial','Preppy','Coastal',
      ].map(v => ({ type: 'style', value: v })),

    ...['Organic','Recycled','Natural','Eco-friendly','Upcycled',
        'Carbon neutral','Vegan','Responsibly sourced',
      ].map(v => ({ type: 'sustainability', value: v })),
  ];

  await prisma.attributeValue.createMany({ skipDuplicates: true, data: rows });
  console.log(`    ✓ ${rows.length} attribute values`);
}
