import { notFound } from 'next/navigation';

interface DesignDetail {
  id:              string;
  title:           string;
  description:     string;
  previewImageUrl: string;
  licenseType:     string;
  licenseModel:    string;
  listingPrice:    number;
  royaltyRate:     number | null;
  licenseCount:    number;
  store:           { name: string; slug: string; logoUrl?: string | null };
}

async function getDesign(id: string): Promise<DesignDetail | null> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
  const res = await fetch(`${apiBase}/marketplace/designs/${id}`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  return res.json();
}

export default async function DesignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const design = await getDesign(id);
  if (!design) notFound();

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
          {design.previewImageUrl ? (
            <img src={design.previewImageUrl} alt={design.title} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-6xl">&#128444;</div>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{design.title}</h1>
            <p className="text-sm text-gray-500">
              by <a href={`/stores/${design.store.slug}`} className="underline">{design.store.name}</a>
            </p>
          </div>
          <p className="text-gray-700">{design.description}</p>
          <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">License Type</span>
              <span className="font-medium">{design.licenseType === 'EXCLUSIVE' ? 'Exclusive (once sold, removed)' : 'Non-Exclusive'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">License Model</span>
              <span className="font-medium">{design.licenseModel?.replace(/_/g, ' ')}</span>
            </div>
            {design.royaltyRate && (
              <div className="flex justify-between">
                <span className="text-gray-600">Royalty Rate</span>
                <span className="font-medium">{(Number(design.royaltyRate) * 100).toFixed(1)}% per sale</span>
              </div>
            )}
            {design.licenseCount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Times Licensed</span>
                <span className="font-medium">{design.licenseCount}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-3xl font-bold text-gray-900">${Number(design.listingPrice).toFixed(2)}</span>
          </div>
          <LicensePurchaseButton designId={design.id} />
        </div>
      </div>
    </main>
  );
}

function LicensePurchaseButton({ designId }: { designId: string }) {
  return (
    <form action={`/api/licenses/${designId}/purchase`} method="POST">
      <button
        type="submit"
        className="w-full rounded-xl bg-gray-900 py-3 text-sm font-bold text-white hover:bg-gray-700"
      >
        Purchase License
      </button>
    </form>
  );
}
