import { getTranslations } from 'next-intl/server';

interface DesignAsset {
  id:              string;
  title:           string;
  description:     string;
  previewImageUrl: string;
  licenseType:     'EXCLUSIVE' | 'NON_EXCLUSIVE';
  licenseModel:    string;
  listingPrice:    number;
  licenseCount:    number;
  store:           { name: string; slug: string };
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

export default async function MarketplaceDesignsPage() {
  const data = await getDesigns();

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Design Licensing Marketplace</h1>
        <p className="text-gray-600">
          License original designs from independent creators. Use them on your products and grow your catalog.
        </p>
      </div>
      {data.items.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No designs listed yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.items.map(design => (
            <DesignCard key={design.id} design={design} />
          ))}
        </div>
      )}
    </main>
  );
}

function DesignCard({ design }: { design: DesignAsset }) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {design.previewImageUrl ? (
          <img
            src={design.previewImageUrl}
            alt={design.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">
            &#128444;
          </div>
        )}
        <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
          design.licenseType === 'EXCLUSIVE'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-blue-100 text-blue-800'
        }`}>
          {design.licenseType === 'EXCLUSIVE' ? 'Exclusive' : 'Non-Exclusive'}
        </span>
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 text-sm truncate">{design.title}</h3>
        <p className="text-xs text-gray-500 truncate">by {design.store.name}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-bold text-gray-900">${Number(design.listingPrice).toFixed(2)}</span>
          {design.licenseCount > 0 && (
            <span className="text-xs text-gray-400">{design.licenseCount} licensed</span>
          )}
        </div>
        <a
          href={`/marketplace/designs/${design.id}`}
          className="mt-2 block text-center rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
        >
          View License
        </a>
      </div>
    </div>
  );
}
