interface Bounty {
  id:         string;
  title:      string;
  brief:      string;
  budget:     number;
  deadline:   string;
  status:     string;
  entryCount: number;
  category?:  string;
  poster:     { firstName: string };
}

interface BountiesResponse {
  items:  Bounty[];
  total:  number;
  open:   number;
}

async function getBounties(): Promise<BountiesResponse> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiBase}/marketplace/bounties`, { next: { revalidate: 60 } });
  if (!res.ok) return { items: [], total: 0, open: 0 };
  return res.json();
}

function hoursLeft(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 3600000);
}

function deadlineLabel(deadline: string) {
  const h = hoursLeft(deadline);
  if (h <= 0)  return { label: 'Expired',      urgent: false, hot: false };
  if (h <= 24) return { label: `🔥 ${h}h left`, urgent: true,  hot: true };
  const days = Math.ceil(h / 24);
  if (days <= 3) return { label: `${days}d left`, urgent: true, hot: false };
  return {
    label: new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    urgent: false,
    hot: false,
  };
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Mug design':    { bg: '#CCFBF1', text: '#0D9488' },
  'T-shirt':       { bg: '#DBEAFE', text: '#1D4ED8' },
  'Sticker':       { bg: '#FEF3C7', text: '#D97706' },
  'Poster':        { bg: '#F3E8FF', text: '#7C3AED' },
  'Logo':          { bg: '#FEE2E2', text: '#DC2626' },
};

function getCategoryStyle(cat?: string) {
  if (!cat) return { bg: '#F0FDF4', text: '#2E7D52' };
  return CATEGORY_COLORS[cat] ?? { bg: '#F0FDF4', text: '#2E7D52' };
}

const FILTER_PILLS = ['All', 'Closing soon 🔥', 'High budget $100+', 'Just posted'];

export default async function MarketplaceBountiesPage() {
  const data = await getBounties();
  const openCount = data.open ?? data.items.filter(b => b.status === 'OPEN').length;

  return (
    <main className="min-h-screen" style={{ background: '#FAFAF8' }}>
      {/* Page header — amber tint */}
      <div className="border-b px-4 py-8" style={{ background: '#FFFBEB', borderColor: '#E8E4DF' }}>
        <div className="container mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Design Bounty Board</h1>
          <p className="text-gray-500">
            Brands and buyers post design briefs. Submit your work. Win the bounty.
          </p>

          {/* Tabs */}
          <div className="flex gap-1 mt-6 border-b" style={{ borderColor: '#E8E4DF' }}>
            {[
              { label: `Open bounties (${openCount})`, active: true },
              { label: 'Completed',                    active: false },
              { label: 'Post a bounty',                active: false, href: '/marketplace/bounties/post' },
            ].map((tab) => (
              <a
                key={tab.label}
                href={tab.href ?? '#'}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
                  tab.active
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

      {/* Filter row */}
      <div className="bg-white border-b px-4 py-3" style={{ borderColor: '#E8E4DF' }}>
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
                style={i === 0 ? { background: '#E85D3F' } : undefined}
              >
                {pill}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-600 bg-white">
              <option>Budget range</option>
              <option>Under $30</option>
              <option>$30–$100</option>
              <option>$100+</option>
            </select>
            <select className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-600 bg-white">
              <option>Sort: Newest</option>
              <option>Sort: Budget ↓</option>
              <option>Sort: Deadline</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {data.items.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-4xl">🎯</p>
            <p className="font-medium text-gray-700">No open bounties right now.</p>
            <p className="text-sm text-gray-500">Be the first to post a design brief!</p>
            <a
              href="/marketplace/bounties/post"
              className="mt-2 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: '#E85D3F' }}
            >
              Post a bounty
            </a>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map(bounty => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function BountyCard({ bounty }: { bounty: Bounty }) {
  const dl       = deadlineLabel(bounty.deadline);
  const catStyle = getCategoryStyle(bounty.category);

  return (
    <div className="rounded-2xl bg-white border p-5 hover:shadow-md transition-shadow space-y-3" style={{ borderColor: '#E8E4DF' }}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0"
          style={{ background: catStyle.bg, color: catStyle.text }}
        >
          {bounty.category ?? 'Design'}
        </span>
        <span className="text-xl font-bold shrink-0" style={{ color: '#2E7D52' }}>
          ${Number(bounty.budget).toFixed(0)}
        </span>
      </div>

      {/* Title + brief */}
      <div>
        <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-1">{bounty.title}</h3>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{bounty.brief}</p>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: '#F3F4F6' }}>
        <span className="text-xs text-gray-400">{bounty.entryCount} entries</span>
        <div className="flex items-center gap-2">
          {dl.hot ? (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: '#FEE2E2', color: '#DC2626' }}>
              {dl.label}
            </span>
          ) : (
            <span className={`text-xs ${dl.urgent ? 'font-semibold text-orange-600' : 'text-gray-400'}`}>
              {dl.label}
            </span>
          )}
          <a
            href={`/marketplace/bounties/${bounty.id}`}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#E85D3F' }}
          >
            Submit design →
          </a>
        </div>
      </div>
    </div>
  );
}
