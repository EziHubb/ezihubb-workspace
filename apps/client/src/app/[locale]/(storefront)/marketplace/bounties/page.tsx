interface Bounty {
  id:          string;
  title:       string;
  brief:       string;
  budget:      number;
  deadline:    string;
  status:      string;
  entryCount:  number;
  poster:      { firstName: string };
}

interface BountiesResponse {
  items: Bounty[];
  total: number;
}

async function getBounties(): Promise<BountiesResponse> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiBase}/marketplace/bounties`, { next: { revalidate: 60 } });
  if (!res.ok) return { items: [], total: 0 };
  return res.json();
}

function daysLeft(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days <= 0) return 'Expired';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

export default async function MarketplaceBountiesPage() {
  const data = await getBounties();

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Design Bounty Board</h1>
          <p className="text-gray-600">
            Brands and sellers post design briefs with cash rewards. Win the bounty, get paid.
          </p>
        </div>
        <a
          href="/marketplace/bounties/post"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Post a Bounty
        </a>
      </div>
      {data.items.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No open bounties right now. Check back soon!</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.items.map(bounty => (
            <BountyCard key={bounty.id} bounty={bounty} />
          ))}
        </div>
      )}
    </main>
  );
}

function BountyCard({ bounty }: { bounty: Bounty }) {
  const dl = daysLeft(bounty.deadline);
  const urgent = dl !== 'Expired' && parseInt(dl) <= 3;

  return (
    <div className="rounded-xl border bg-white p-5 hover:shadow-md transition-shadow space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 leading-tight">{bounty.title}</h3>
        <span className="text-xl font-bold text-green-700 whitespace-nowrap">${Number(bounty.budget).toFixed(0)}</span>
      </div>
      <p className="text-sm text-gray-600 line-clamp-2">{bounty.brief}</p>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{bounty.entryCount} submissions</span>
        <span className={urgent ? 'text-red-600 font-medium' : ''}>{dl}</span>
      </div>
      <a
        href={`/marketplace/bounties/${bounty.id}`}
        className="block text-center rounded-lg bg-gray-900 py-2 text-sm font-semibold text-white hover:bg-gray-700"
      >
        View &amp; Submit
      </a>
    </div>
  );
}
