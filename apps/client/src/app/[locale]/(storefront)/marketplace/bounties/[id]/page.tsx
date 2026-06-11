import { notFound } from 'next/navigation';

interface BountyDetail {
  id:             string;
  title:          string;
  brief:          string;
  budget:         number;
  platformFee:    number;
  winnerPayout:   number;
  deadline:       string;
  status:         string;
  maxSubmissions: number | null;
  entryCount:     number;
  poster:         { firstName: string };
}

async function getBounty(id: string): Promise<BountyDetail | null> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiBase}/marketplace/bounties/${id}`, { next: { revalidate: 30 } });
  if (!res.ok) return null;
  return res.json();
}

export default async function BountyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bounty = await getBounty(id);
  if (!bounty) notFound();

  const deadline  = new Date(bounty.deadline);
  const isExpired = deadline.getTime() < Date.now();

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{bounty.title}</h1>
            <p className="text-sm text-gray-500 mt-1">Posted by {bounty.poster.firstName}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-green-700">${Number(bounty.budget).toFixed(0)}</div>
            <div className="text-xs text-gray-500">
              Winner earns ${Number(bounty.winnerPayout).toFixed(0)}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 p-5 space-y-2">
          <h2 className="font-semibold text-gray-900">Design Brief</h2>
          <p className="text-gray-700 whitespace-pre-line">{bounty.brief}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-lg border bg-white p-3">
            <div className="font-bold text-gray-800">{bounty.entryCount}</div>
            <div className="text-xs text-gray-500">Submissions</div>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <div className={`font-bold ${isExpired ? 'text-red-600' : 'text-gray-800'}`}>
              {isExpired ? 'Expired' : deadline.toLocaleDateString()}
            </div>
            <div className="text-xs text-gray-500">Deadline</div>
          </div>
          <div className="rounded-lg border bg-white p-3">
            <div className="font-bold text-gray-800">
              {bounty.maxSubmissions ? `${bounty.entryCount}/${bounty.maxSubmissions}` : bounty.entryCount}
            </div>
            <div className="text-xs text-gray-500">Entries</div>
          </div>
        </div>

        {bounty.status === 'OPEN' && !isExpired && (
          <div className="rounded-xl border-2 border-dashed border-gray-300 p-6 text-center space-y-3">
            <p className="text-gray-600 text-sm">Submit your design to win the bounty</p>
            <a
              href={`/marketplace/bounties/${bounty.id}/submit`}
              className="inline-block rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-gray-700"
            >
              Submit Design
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
