export function OrganizationStructuredData() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MapleLoomHandmade',
    url: 'https://mapleloomhandmade.com',
    logo: 'https://mapleloomhandmade.com/logo.png',
    sameAs: [
      'https://instagram.com/mapleloomhandmade',
      'https://facebook.com/mapleloomhandmade',
      'https://pinterest.com/mapleloomhandmade',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'support@mapleloomhandmade.com',
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
