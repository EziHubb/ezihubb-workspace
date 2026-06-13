export function OrganizationStructuredData() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'DailyDaisy',
    url: 'https://dailydaisy.com',
    logo: 'https://dailydaisy.com/logo.png',
    sameAs: [
      'https://instagram.com/dailydaisy',
      'https://facebook.com/dailydaisy',
      'https://pinterest.com/dailydaisy',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'support@dailydaisy.com',
      availableLanguage: ['English', 'Vietnamese'],
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
