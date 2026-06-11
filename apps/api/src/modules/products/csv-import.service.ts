import { Injectable, Logger } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../../prisma/prisma.service';

// ── Template columns ──────────────────────────────────────────────────────────

export const CSV_COLUMNS = [
  'name',
  'slug',
  'description',
  'shortDescription',
  'basePrice',
  'compareAtPrice',
  'status',
  'categorySlug',
  'tags',
  'collectionSlugs',
  'isPersonalizable',
  'isFeatured',
  'processingDays',
  'variationGroupName',
  'variationGroupType',
  'variationOptions',
  'images',
] as const;

// ── Public shapes ─────────────────────────────────────────────────────────────

export interface CsvValidationError {
  row: number;
  column: string;
  message: string;
}

export interface CsvValidationResult {
  totalRows:   number;
  validRows:   number;
  invalidRows: number;
  errors:      CsvValidationError[];
  preview:     Array<{
    row:          number;
    name:         string;
    status:       string;
    categorySlug: string;
    basePrice:    number;
    tags:         string[];
  }>;
}

export interface CsvImportResult {
  imported: number;
  updated:  number;
  failed:   number;
  errors:   Array<{ row: number; message: string }>;
}

// ── Internal ──────────────────────────────────────────────────────────────────

interface ParsedRow {
  rowNumber:         number;
  name:              string;
  slug:              string;
  description:       string;
  shortDescription:  string;
  basePrice:         number;
  compareAtPrice?:   number;
  status:            ProductStatus;
  categorySlug:      string;
  tags:              string[];
  collectionSlugs:   string[];
  isPersonalizable:  boolean;
  isFeatured:        boolean;
  processingDays:    number;
  variationGroupName?: string;
  variationGroupType?: string;
  variationOptions:  Array<{ name: string; price: number }>;
  images:            string[];
}

const VALID_STATUSES = new Set<string>(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']);

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CsvImportService {
  private readonly logger = new Logger(CsvImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Template ────────────────────────────────────────────────────────────────

  generateTemplate(): Buffer {
    const header = CSV_COLUMNS.join(',');
    const example = [
      'Classic Portrait Frame',
      'classic-portrait-frame',
      'A beautiful personalized portrait frame',
      'Personalized family portrait',
      '49.99',
      '79.99',
      'ACTIVE',
      'frames',
      'personalized,gift,family',
      'best-sellers|new-arrivals',
      'true',
      'false',
      '3',
      'Size',
      'SELECT',
      '8x10:49.99|11x14:69.99|16x20:99.99',
      'https://example.com/img1.jpg|https://example.com/img2.jpg',
    ].join(',');
    return Buffer.from(`${header}\n${example}\n`, 'utf8');
  }

  // ── Validate (dry-run) ───────────────────────────────────────────────────────

  async validateCsv(buffer: Buffer): Promise<CsvValidationResult> {
    const { rows, parseErrors } = this.parseCsvBuffer(buffer);

    if (parseErrors.length > 0) {
      return {
        totalRows:   0,
        validRows:   0,
        invalidRows: 0,
        errors:      parseErrors,
        preview:     [],
      };
    }

    const errors: CsvValidationError[] = [];
    const valid: ParsedRow[] = [];

    for (const row of rows) {
      const rowErrors = this.validateRow(row);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else {
        valid.push(row);
      }
    }

    return {
      totalRows:   rows.length,
      validRows:   valid.length,
      invalidRows: rows.length - valid.length,
      errors,
      preview:     valid.slice(0, 20).map((r) => ({
        row:          r.rowNumber,
        name:         r.name,
        status:       r.status,
        categorySlug: r.categorySlug,
        basePrice:    r.basePrice,
        tags:         r.tags,
      })),
    };
  }

  // ── Execute ──────────────────────────────────────────────────────────────────

  async executeCsvImport(buffer: Buffer): Promise<CsvImportResult> {
    const { rows, parseErrors } = this.parseCsvBuffer(buffer);

    if (parseErrors.length > 0) {
      return { imported: 0, updated: 0, failed: rows.length, errors: parseErrors.map((e) => ({ row: e.row, message: e.message })) };
    }

    const result: CsvImportResult = { imported: 0, updated: 0, failed: 0, errors: [] };

    for (const row of rows) {
      const rowErrors = this.validateRow(row);
      if (rowErrors.length > 0) {
        result.failed++;
        result.errors.push({ row: row.rowNumber, message: rowErrors.map((e) => `${e.column}: ${e.message}`).join('; ') });
        continue;
      }

      try {
        const wasUpdated = await this.upsertRow(row);
        if (wasUpdated) result.updated++;
        else result.imported++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Row ${row.rowNumber} import failed: ${msg}`);
        result.failed++;
        result.errors.push({ row: row.rowNumber, message: msg });
      }
    }

    this.logger.log(`CSV import done — imported:${result.imported} updated:${result.updated} failed:${result.failed}`);
    return result;
  }

  // ── Parsing ──────────────────────────────────────────────────────────────────

  private parseCsvBuffer(buffer: Buffer): { rows: ParsedRow[]; parseErrors: CsvValidationError[] } {
    let rawRows: Record<string, string>[];

    try {
      rawRows = parse(buffer, {
        columns:          true,
        skip_empty_lines: true,
        trim:             true,
        bom:              true,
      }) as Record<string, string>[];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { rows: [], parseErrors: [{ row: 0, column: 'file', message: `CSV parse error: ${msg}` }] };
    }

    if (rawRows.length > 1000) {
      return {
        rows:        [],
        parseErrors: [{ row: 0, column: 'file', message: `File has ${rawRows.length} rows; maximum is 1000` }],
      };
    }

    const rows: ParsedRow[] = [];
    const parseErrors: CsvValidationError[] = [];

    rawRows.forEach((raw, idx) => {
      const rowNumber = idx + 2; // 1-based, row 1 is header
      const parsed = this.parseRow(raw, rowNumber);
      if ('error' in parsed) {
        parseErrors.push(parsed.error);
      } else {
        rows.push(parsed);
      }
    });

    return { rows, parseErrors };
  }

  private parseRow(raw: Record<string, string>, rowNumber: number): ParsedRow | { error: CsvValidationError } {
    // basePrice — numeric parse
    const basePriceStr = raw['basePrice']?.trim() ?? '';
    const basePrice = Number(basePriceStr);
    if (basePriceStr === '' || isNaN(basePrice)) {
      return { error: { row: rowNumber, column: 'basePrice', message: `"${basePriceStr}" is not a valid number` } };
    }

    const compareAtPriceStr = raw['compareAtPrice']?.trim() ?? '';
    const compareAtPrice = compareAtPriceStr !== '' ? Number(compareAtPriceStr) : undefined;
    if (compareAtPriceStr !== '' && isNaN(compareAtPrice!)) {
      return { error: { row: rowNumber, column: 'compareAtPrice', message: `"${compareAtPriceStr}" is not a valid number` } };
    }

    const processingDaysStr = raw['processingDays']?.trim() ?? '';
    const processingDays = processingDaysStr !== '' ? parseInt(processingDaysStr, 10) : 3;
    if (isNaN(processingDays) || processingDays < 1) {
      return { error: { row: rowNumber, column: 'processingDays', message: `"${processingDaysStr}" must be a positive integer` } };
    }

    // status — normalize to uppercase
    const statusRaw  = (raw['status']?.trim() ?? 'DRAFT').toUpperCase();
    const status     = VALID_STATUSES.has(statusRaw) ? (statusRaw as ProductStatus) : 'DRAFT';

    // tags & collections
    const tags           = (raw['tags']?.trim() ?? '').split(',').map((t) => t.trim()).filter(Boolean);
    const collectionSlugs = (raw['collectionSlugs']?.trim() ?? '').split('|').map((s) => s.trim()).filter(Boolean);

    // variation options — "Name:price|Name:price"
    const variationOptions = (raw['variationOptions']?.trim() ?? '')
      .split('|')
      .map((part) => {
        const [name, priceStr] = part.split(':');
        const price = Number(priceStr);
        return (name?.trim() && !isNaN(price)) ? { name: name.trim(), price } : null;
      })
      .filter((v): v is { name: string; price: number } => v !== null);

    // images — pipe-separated URLs
    const images = (raw['images']?.trim() ?? '').split('|').map((u) => u.trim()).filter(Boolean);

    const name = raw['name']?.trim() ?? '';
    const slug = raw['slug']?.trim() ?? '';

    return {
      rowNumber,
      name,
      slug,
      description:       raw['description']?.trim()      ?? '',
      shortDescription:  raw['shortDescription']?.trim() ?? '',
      basePrice,
      compareAtPrice,
      status,
      categorySlug: raw['categorySlug']?.trim() ?? '',
      tags,
      collectionSlugs,
      isPersonalizable: (raw['isPersonalizable']?.trim().toLowerCase() ?? 'true') !== 'false',
      isFeatured:       (raw['isFeatured']?.trim().toLowerCase() ?? 'false') === 'true',
      processingDays,
      variationGroupName: raw['variationGroupName']?.trim() || undefined,
      variationGroupType: raw['variationGroupType']?.trim() || undefined,
      variationOptions,
      images,
    };
  }

  // ── Row validation ────────────────────────────────────────────────────────────

  private validateRow(row: ParsedRow): CsvValidationError[] {
    const errors: CsvValidationError[] = [];
    const e = (column: string, message: string) => errors.push({ row: row.rowNumber, column, message });

    if (!row.name)         e('name',         'Name is required');
    if (row.basePrice <= 0) e('basePrice',    'Base price must be greater than 0');
    if (!row.categorySlug) e('categorySlug', 'Category slug is required');

    if (row.compareAtPrice !== undefined && row.compareAtPrice <= row.basePrice) {
      e('compareAtPrice', 'Compare-at price must be greater than base price');
    }

    return errors;
  }

  // ── Upsert ───────────────────────────────────────────────────────────────────

  private async upsertRow(row: ParsedRow): Promise<boolean> {
    // 1 — resolve category
    const category = await this.prisma.category.findUnique({ where: { slug: row.categorySlug } });
    if (!category) throw new Error(`Category not found: "${row.categorySlug}"`);

    // 2 — resolve collections (skip missing silently)
    const collections = row.collectionSlugs.length
      ? await this.prisma.collection.findMany({ where: { slug: { in: row.collectionSlugs } } })
      : [];

    // 3 — upsert tags
    const tagIds = await Promise.all(
      row.tags.map((name) =>
        this.prisma.tag.upsert({
          where:  { name },
          update: {},
          create: { name, slug: this.slugify(name) },
        }).then((t) => t.id),
      ),
    );

    // 4 — resolve slug
    const slug = row.slug || this.slugify(row.name);

    // 5 — check if product exists by slug
    const existing = await this.prisma.product.findFirst({ where: { slug } });

    if (existing) {
      // UPDATE — minimal scalar-only update; skip relations for safety
      await this.prisma.product.update({
        where: { id: existing.id },
        data:  {
          name:             row.name,
          description:      row.description,
          shortDescription: row.shortDescription || undefined,
          basePrice:        row.basePrice,
          compareAtPrice:   row.compareAtPrice ?? null,
          status:           row.status,
          isActive:         row.status === 'ACTIVE',
          isPersonalizable: row.isPersonalizable,
          isFeatured:       row.isFeatured,
          processingDays:   row.processingDays,
          categoryId:       category.id,
        },
      });
      return true; // was updated
    }

    // CREATE — generate unique SKU
    const sku = await this.generateUniqueSku(slug);

    await this.prisma.product.create({
      data: {
        name:             row.name,
        slug,
        sku,
        description:      row.description,
        shortDescription: row.shortDescription || undefined,
        basePrice:        row.basePrice,
        compareAtPrice:   row.compareAtPrice ?? undefined,
        status:           row.status,
        isActive:         row.status === 'ACTIVE',
        isPersonalizable: row.isPersonalizable,
        isFeatured:       row.isFeatured,
        processingDays:   row.processingDays,
        categoryId:       category.id,
        tags: tagIds.length
          ? { create: tagIds.map((tagId) => ({ tagId })) }
          : undefined,
        collections: collections.length
          ? { create: collections.map((c, i) => ({ collectionId: c.id, sortOrder: i })) }
          : undefined,
        images: row.images.length
          ? { create: row.images.map((url, i) => ({ url, sortOrder: i, isPrimary: i === 0 })) }
          : undefined,
      },
    });

    // Optionally create a variation group
    if (row.variationGroupName && row.variationOptions.length > 0) {
      const product = await this.prisma.product.findFirst({ where: { slug } });
      if (product) {
        await this.prisma.variationGroup.create({
          data: {
            productId:   product.id,
            name:        row.variationGroupName,
            displayType: row.variationGroupType?.toLowerCase() ?? 'dropdown',
            sortOrder:   0,
            options: {
              create: row.variationOptions.map((o, i) => ({
                name:      o.name,
                value:     o.name,
                sortOrder: i,
              })),
            },
          },
        });
      }
    }

    return false; // was created
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async generateUniqueSku(slug: string): Promise<string> {
    const base = slug.replace(/-/g, '').toUpperCase().slice(0, 8);
    for (let attempt = 0; attempt < 10; attempt++) {
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      const sku  = `MLH-${base}-${rand}`;
      const conflict = await this.prisma.product.findUnique({ where: { sku }, select: { id: true } });
      if (!conflict) return sku;
    }
    throw new Error(`Unable to generate unique SKU for slug "${slug}" after 10 attempts`);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
