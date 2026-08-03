import type { ProductAttributeDto } from '@ezihubb/types';

// ── Attribute grouping ────────────────────────────────────────────────────────

const ATTRIBUTE_GROUPS: Record<string, string[]> = {
  'Material & Build': ['Material', 'Construction', 'Weight', 'Frame'],
  'Dimensions':       ['Size', 'Dimensions', 'Capacity', 'Height', 'Width', 'Diameter'],
  'Care & Safety':    ['Dishwasher Safe', 'Microwave Safe', 'Food Safe', 'BPA Free', 'Care', 'Juice Groove'],
  'Print Details':    ['Print Method', 'Print Area', 'Resolution', 'Engrave Method', 'Frame', 'Insulation'],
  'Fit & Style':      ['Fit', 'Style', 'Collar', 'Sleeve', 'Cold', 'Hot', 'Protection', 'Print'],
};

function getGroup(key: string): string {
  for (const [group, keys] of Object.entries(ATTRIBUTE_GROUPS)) {
    if (keys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) return group;
  }
  return 'Other';
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProductSpecificationsProps {
  attributes: ProductAttributeDto[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductSpecifications({ attributes }: ProductSpecificationsProps) {
  if (attributes.length === 0) return null;

  const useGrouping = attributes.length >= 4;

  if (!useGrouping) {
    // ── Flat list for < 4 attributes ──────────────────────────────────────
    return (
      <dl className="text-sm">
        {attributes.map((attr, idx) => (
          <div
            key={attr.key}
            className={[
              'grid grid-cols-[1fr_1fr] sm:grid-cols-[180px_1fr] gap-x-4 py-2.5 border-b border-[#F3F4F6]',
              idx % 2 === 0 ? 'bg-[#FAFAF8]' : '',
              'px-2 -mx-2',
            ].join(' ')}
          >
            <dt className="font-medium text-secondary self-center">{attr.key}</dt>
            <dd className="text-muted self-center">
              {attr.value}
              {attr.unit && <span className="ml-1 text-xs">{attr.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  // ── Grouped layout for ≥ 4 attributes ────────────────────────────────────
  const grouped = new Map<string, ProductAttributeDto[]>();
  for (const attr of attributes) {
    const g = getGroup(attr.key);
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(attr);
  }

  // Order: known groups first, then 'Other'
  const orderedGroups = [
    ...Object.keys(ATTRIBUTE_GROUPS).filter((g) => grouped.has(g)),
    ...(grouped.has('Other') ? ['Other'] : []),
  ];

  return (
    <div className="space-y-5">
      {orderedGroups.map((group) => {
        const attrs = grouped.get(group) ?? [];
        return (
          <div key={group}>
            <h6 className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">
              {group}
            </h6>
            <dl className="text-sm">
              {attrs.map((attr, idx) => (
                <div
                  key={attr.key}
                  className={[
                    'grid grid-cols-[1fr_1fr] sm:grid-cols-[180px_1fr] gap-x-4 py-2.5 border-b border-[#F3F4F6]',
                    idx % 2 === 0 ? 'bg-[#FAFAF8]' : '',
                    'px-2 -mx-2',
                  ].join(' ')}
                >
                  <dt className="font-medium text-secondary self-center">{attr.key}</dt>
                  <dd className="text-muted self-center">
                    {attr.value}
                    {attr.unit && <span className="ml-1 text-xs">{attr.unit}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
