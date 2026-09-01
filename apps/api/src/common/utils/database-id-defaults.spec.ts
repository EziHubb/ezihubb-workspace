import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schemaPath = resolve(__dirname, '../../../../../prisma/schema.prisma');

describe('database primary-key defaults', () => {
  const schema = readFileSync(schemaPath, 'utf8');

  it('uses 12-character NanoID defaults for generated String primary keys', () => {
    let currentModel = '';
    const invalidModels: string[] = [];

    for (const line of schema.split(/\r?\n/)) {
      const modelMatch = line.match(/^model\s+(\w+)\s+\{/);
      if (modelMatch) currentModel = modelMatch[1];

      if (!/^\s+id\s+String\b.*@id\b/.test(line)) continue;

      const isSingleton = line.includes('@default("singleton")');
      const hasNanoIdDefault = line.includes('@default(dbgenerated("nanoid(12)"))');
      if (!isSingleton && !hasNanoIdDefault) invalidModels.push(currentModel);
    }

    expect(invalidModels).toEqual([]);
  });

  it('does not retain Prisma CUID defaults', () => {
    expect(schema).not.toContain('@default(cuid())');
  });
});
