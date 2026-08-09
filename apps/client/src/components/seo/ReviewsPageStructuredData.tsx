import { fmtRating } from '@ezihubb/utils';

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
    name: 'EziHubb',
    url: 'https://ezihubb.com',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: fmtRating(avgRating),
      reviewCount: totalCount,
      bestRating: '5',
      worstRating: '1',
    },
  };
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- static JSON.stringify output, not user input
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
