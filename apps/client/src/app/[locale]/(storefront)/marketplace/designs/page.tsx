interface DesignAsset {
  id:              string;
  title:           string;
  description:     string;
  previewImageUrl: string;
  licenseType:     'EXCLUSIVE' | 'NON_EXCLUSIVE';
  licenseModel:    string;
  listingPrice:    number;
  licenseCount:    number;
  store:           { name: string; slug: string; logoUrl?: string };
  createdAt:       string;
}

interface DesignsResponse {
  items: DesignAsset[];
  total: number;
  page:  number;
  limit: number;
}

async function getDesigns(page = 1): Promise<DesignsResponse> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiBase}/marketplace/designs?page=${page}&limit=24`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return { items: [], total: 0, page: 1, limit: 24 };
  return res.json();
}

const FILTER_TABS = [
  { label: 'Browse designs',       href: '/marketplace/designs' },
  { label: 'My licenses (3)',      href: '/marketplace/designs/my-licenses' },
  { label: 'List your designs',    href: '/seller/licenses/new' },
];

const FILTER_PILLS = ['All', 'Non-exclusive', 'Exclusive available', 'New this week'];

export default async function MarketplaceDesignsPage() {
  const data = await getDesigns();

  return (
    <main className="min-h-screen" style={{ background: '#FAFAF8' }}>
      {/* Page header */}
      <div className="border-b bg-white px-4 py-8" style={{ borderColor: '#E8E4DF' }}>
        <div className="container mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Design Marketplace</h1>
          <p className="text-gray-500">
            License original designs from top creators. Use on any product in your store.
          </p>

          {/* Tabs */}
          <div className="flex gap-1 mt-6 border-b" style={{ borderColor: '#E8E4DF' }}>
            {FILTER_TABS.map((tab, i) => (
              <a
                key={tab.label}
                href={tab.href}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
                  i === 0
                    ? 'border-[#E85D3F] text-[#E85D3F]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky filter row */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3" style={{ borderColor: '#E8E4DF' }}>
        <div className="container mx-auto max-w-7xl flex items-center gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap flex-1">
            {FILTER_PILLS.map((pill, i) => (
              <button
                key={pill}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  i === 0
                    ? 'text-white border-transparent'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
                style={i === 0 ? { background: '#E85D3F', borderColor: '#E85D3F' } : undefined}
              >
                {pill}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-600 bg-white">
              <option>Category</option>
            </select>
            <select className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-600 bg-white">
              <option>Sort: Popular</option>
              <option>Sort: Newest</option>
              <option>Sort: Price ↑</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {data.items.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">🎨</p>
            <p className="text-gray-500 font-medium">No designs listed yet.</p>
            <a
              href="/seller/licenses/new"
              className="mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: '#E85D3F' }}
            >
              List your first design
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.items.map(design => (
              <DesignCard key={design.id} design={design} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function DesignCard({ design }: { design: DesignAsset }) {
  const isExclusive = design.licenseType === 'EXCLUSIVE';

  return (
    <div className="rounded-2xl bg-white border overflow-hidden hover:shadow-md transition-shadow group" style={{ borderColor: '#E8E4DF' }}>
      {/* Image */}
      <div className="aspect-square relative overflow-hidden bg-gray-100">
        {design.previewImageUrl ? (
          <img
            src={design.previewImageUrl}
            alt={design.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-5xl">🎨</div>
        )}

        {/* Watermark overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          style={{ background: 'linear-gradient(135deg, transparent 40%, rgba(0,0,0,0.04) 100%)' }}
        >
          <span
            className="text-[10px] font-medium text-gray-300 rotate-[-30deg] whitespace-nowrap"
            style={{ textShadow: 'none', opacity: 0.5 }}
          >
            Daily Daisy · Licensed
          </span>
        </div>

        {/* License type badge */}
        <span
          className={`absolute top-2 right-2 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            isExclusive
              ? 'bg-amber-100 text-amber-800 border border-amber-200'
              : 'bg-gray-100 text-gray-600 border border-gray-200'
          }`}
        >
          {isExclusive ? 'Exclusive' : 'Non-exclusive'}
        </span>

        {/* Hover preview overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="bg-white/90 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800">
            Preview
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-3.5">
        <h3 className="font-semibold text-gray-900 text-sm truncate">{design.title}</h3>
        <div className="flex items-center gap-1.5 mt-0.5">
          {design.store.logoUrl && (
            <img src={design.store.logoUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
          )}
          <a
            href={`/shops/${design.store.slug}`}
            className="text-xs text-gray-400 hover:text-primary transition-colors truncate"
            onClick={(e) => e.stopPropagation()}
          >
            by {design.store.name}
          </a>
        </div>

        {/* Price */}
        <div className="mt-2.5 flex items-center justify-between">
          <div>
            <span className="font-bold text-sm" style={{ color: '#E85D3F' }}>
              ${Number(design.listingPrice).toFixed(2)}
            </span>
            {design.licenseModel === 'ROYALTY' && (
              <span className="text-xs text-gray-400 ml-1">+ royalty</span>
            )}
          </div>
          {design.licenseCount > 0 && (
            <span className="text-[10px] text-gray-400">{design.licenseCount} licensed</span>
          )}
        </div>

        <a
          href={`/marketplace/designs/${design.id}`}
          className="mt-3 block text-center rounded-xl py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#E85D3F' }}
        >
          License this →
        </a>
      </div>
    </div>
  );
}
