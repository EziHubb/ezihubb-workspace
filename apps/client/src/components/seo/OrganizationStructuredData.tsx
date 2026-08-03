export function OrganizationStructuredData() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'EziHubb',
    url: 'https://ezihubb.com',
    logo: 'https://ezihubb.com/logo.png',
    sameAs: [
      'https://instagram.com/ezihubb',
      'https://facebook.com/ezihubb',
      'https://pinterest.com/ezihubb',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'support@ezihubb.com',
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
