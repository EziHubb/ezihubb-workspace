export function ReviewsPageStructuredData({
  avgRating,
  totalCount,
}: {
  avgRating: number;
  totalCount: number;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'MapleLoomHandmade',
    url: 'https://mapleloomhandmade.com',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: avgRating.toFixed(1),
      reviewCount: totalCount,
      bestRating: '5',
      worstRating: '1',
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
