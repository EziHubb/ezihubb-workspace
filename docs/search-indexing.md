# Product and shop search indexing — 2026-11-01

Read-only production observations with a Googlebot User-Agent:
- `/en/shops/ezihubb` returned a meaningful `EziHubb — Shop` title, but no title in the initial `<head>`. The title/canonical/description arrived later through Next metadata streaming. The shop had zero product anchors in the initial HTML.
- The Saja Boy wrap-skort product had its actual title, H1 and self-referencing `/en/products/...` canonical, without noindex. Its title was also outside the head. Its URL was already present in the public sitemap; the sitemap contained no shop URLs.
- These observations identify technical improvements, not the definitive reason Google omitted a result. Next documents that Googlebot supports streaming metadata. Search Console coverage, Google's selected canonical, crawl history and ranking signals were not inspected.

## Repository changes

- Block metadata streaming for the storefront so title/canonical/description arrive in the head for every user agent. This can increase time to first byte while metadata loads; per-request React cache shares product/shop detail reads between metadata and page content.
- Use matching explicit locale headers for metadata and visible content. Treat actual API 404s as missing pages; propagate outages instead of publishing a false not-found/noindex result.
- Render the shop's first 24 newest products through initial data in its existing grid. Initial data applies only to the matching default query; filters, sorts and subsequent pages still fetch their own results. Query keys include locale.
- Add active shop URLs in EN/VI/ZH to the sitemap, fix the public shops API pagination order, include product language alternates, remove the translated-product top-100 cutoff and noncanonical tag-filter entries, traverse category leaves, and omit invented modification timestamps. Public catalog requests use supported parameters.
- Product metadata has matching search/social titles, nonblank descriptions and primary images.

## Checks and release boundary

`pnpm nx run client:test-seo` runs Node-only metadata/sitemap tests with synthetic fetch responses. It does not start Next, render components or run Playwright. Run client typecheck/lint and the API stores unit test as well. Verified on 2026-11-01: 6/6 Node-only SEO tests and 18/18 StoresService tests passed; client typecheck passed; client lint passed with 228 warnings/0 errors (budget 232), API lint passed with 175 warnings/0 errors; scoped diff whitespace check passed. No assertion or lint budget was weakened. The machine lacks a pnpm executable, so checks used the installed Nx via `npm exec --no -- nx`; tsx IPC and the TypeScript incremental cache required sandbox write permission.

Build, browser/SSR output after the change, production rollout and Google recrawl remain unverified until explicitly performed.

After an authorized deployment, inspect the actual head and product anchors with ordinary and Googlebot requests, verify public sitemap/redirect/canonical responses, then use Search Console URL Inspection for the shop and representative product and resubmit `/sitemap.xml`. Check indexing/canonical/exclusion reasons rather than assuming discovery guarantees ranking. Google may take days to weeks to recrawl and does not guarantee inclusion or ranking.

The sitemap remains bounded to 1,920 products and 1,920 shops per catalog; split into sitemap files before crossing that limit. No payment settings, catalog names, production data or Search Console account settings are changed.

References: [Next metadata streaming](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#streaming-metadata), [Google title links](https://developers.google.com/search/docs/appearance/title-link), [crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable), [recrawl requests](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).
