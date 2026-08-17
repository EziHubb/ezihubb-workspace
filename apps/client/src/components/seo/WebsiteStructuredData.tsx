export function WebsiteStructuredData() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'EziHubb',
    url: 'https://ezihubb.com/en',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        // '/en' is required: next-intl's localePrefix defaults to 'always',
        // so a bare '/search' would 307-redirect before Google could resolve
        // the sitelinks-searchbox template.
        urlTemplate: 'https://ezihubb.com/en/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
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
