import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TopProductDto {
  id:           string;
  name:         string;
  slug:         string;
  imageUrl?:    string;
  categoryName: string;
  unitsSold:    number;
  revenue:      number;
  rating?:      number;
}

// ── Rank badge ────────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1 ? 'bg-primary text-white'
    : rank === 2 ? 'bg-gray-400 text-white'
    : rank === 3 ? 'bg-[#CD7F32] text-white'
    : 'bg-background text-muted border border-border';

  return (
    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${cls}`}>
      {rank}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TopProductsTableProps {
  products: TopProductDto[];
}

export function TopProductsTable({ products }: TopProductsTableProps) {
  return (
    <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h5 className="font-semibold text-secondary text-sm">Top Products</h5>
        <Link href="/products" className="text-xs text-primary hover:underline font-medium">
          View all →
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              {['#', 'Product', 'Category', 'Units', 'Revenue', 'Rating'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted text-sm">
                  No data yet
                </td>
              </tr>
            ) : (
              products.map((p, i) => (
                <tr key={p.id} className="hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-4 py-3">
                    <RankBadge rank={i + 1} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-sm overflow-hidden bg-background shrink-0">
                        {p.imageUrl ? (
                          <Image
                            src={p.imageUrl}
                            alt={p.name}
                            width={32}
                            height={32}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full bg-border/30" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-secondary truncate max-w-[160px]">
                        {p.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{p.categoryName}</td>
                  <td className="px-4 py-3 text-secondary tabular-nums">{p.unitsSold.toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold text-secondary tabular-nums">
                    ${p.revenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3">
                    {p.rating != null ? (
                      <span className="flex items-center gap-1 text-xs text-secondary">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        {p.rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
