import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seed15Moderation() {
  await prisma.moderationSettings.upsert({
    where:  { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  const createdBy = adminUser?.id ?? 'system';

  const starterRules = [
    { name: 'Drug sales',        ruleType: 'CATEGORY', value: 'drugs_illegal',   severity: 'CRITICAL', applyTo: ['Product', 'Store'] },
    { name: 'Weapons',           ruleType: 'CATEGORY', value: 'weapons_illegal', severity: 'CRITICAL', applyTo: ['Product', 'Store'] },
    { name: 'CSAM',              ruleType: 'CATEGORY', value: 'csam',            severity: 'CRITICAL', applyTo: ['Product', 'Store', 'Review', 'Message'] },
    { name: 'Hate speech',       ruleType: 'CATEGORY', value: 'hate_speech',     severity: 'HIGH',     applyTo: ['Product', 'Store', 'Review', 'Message'] },
    { name: 'Adult content',     ruleType: 'CATEGORY', value: 'adult_content',   severity: 'HIGH',     applyTo: ['Product', 'Store'] },
    { name: 'Counterfeit',       ruleType: 'CATEGORY', value: 'counterfeit',     severity: 'HIGH',     applyTo: ['Product', 'Store'] },
    { name: 'Spam/misleading',   ruleType: 'CATEGORY', value: 'spam_misleading', severity: 'MEDIUM',   applyTo: ['Product', 'Store', 'Review'] },
    { name: 'Contact info leak', ruleType: 'CATEGORY', value: 'contact_info',    severity: 'LOW',      applyTo: ['Message', 'Review'] },
  ];

  for (const rule of starterRules) {
    await prisma.moderationRule.upsert({
      where:  { id: `seed-${rule.value}` },
      update: { isActive: true },
      create: { id: `seed-${rule.value}`, ...rule, createdBy },
    });
  }

  console.log('✅ Seeded ModerationSettings + starter rules');
}
