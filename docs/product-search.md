# Product search page

Decisions behind the client search page, and the parts of it that are
deliberately not in the reference screenshots.

The reference lives in `docs/ref-assets/` (gitignored). It is a set of
screenshots of a competitor's search page, used as a guide for **structure,
spacing, hierarchy and behaviour only**. Colours come from the app's own
tokens in `libs/ui/tailwind.config.js`; every string is our own copy; no icon
or image asset was copied.

## Ours, not in the reference — do not remove for "matching the images"

Someone comparing this page against the screenshots will find these and think
they are drift. They are not. Each is here on purpose:

| Feature | Why it stays |
|---|---|
| Active-filter chips with individual remove | The reference has no equivalent. Shows what is currently applied and lets one filter be dropped without opening the panel. Strictly more useful than nothing. |
| Wishlist button on each card | Real feature with a real backing endpoint. |
| `bestseller` sort option | Backed by `soldCount`, which is real data, so the option genuinely sorts. The reference's five options are all present too. |
| `inCarts` badge | Says exactly what is happening — N shoppers have this in their basket right now. Kept over the reference's vaguer "Popular now". |
| `sale` / `editorsPick` / `new` badges | Existing badges with existing triggers. |
| Breadcrumb | Navigation aid the reference lacks. |
| Mobile filter sheet | The reference has no mobile screenshot at all, so there is nothing to match. Left exactly as it was. |
| Empty and loading states | Same — no reference screenshot exists for either. |
| Error state | New, and also not in the reference. See below. |
| Search suggestions | Untouched this round. |

## Error state

`SearchError` is checked **before** the empty-results branch, and that order
matters. A failed request also produces zero rows, so falling through to
"nothing matched your search" tells a shopper their query is wrong while the
real problem is the server. Retry refetches in place, so the filters and page
already in the URL survive.

## Filter groups

### Order

Decided by us. The reference screenshots have no overlapping region between
them, so their vertical order could not be recovered from the images — this
is not a case of ignoring the reference, there was nothing to read.

Ordered by how much a group narrows a result set and how many shoppers touch
it: price and offers before attribute filters, shop reputation last.

The first four are open by default. Opening every group makes a column nobody
scrolls to the bottom of; closing every group hides what is even on offer.

### Category drill-down

Built as a hierarchy, not a flat list: production has 130 categories across
three levels (6 / 23 / 101), so a flat list of roots narrows nothing useful
and a flat list of everything is unreadable.

- Clicking any node filters by that node **and everything under it**. This
  required an API change: the filter used to match one exact `categoryId`,
  and since 101 of the 130 categories are leaves, clicking a parent returned
  nothing at all. See the commit on `search.service.ts`.
- The URL carries only `?category=<slug>` — the parameter the API already
  takes. The open branch is rebuilt by walking `parentId` in the tree that is
  already loaded, so pasting a link opens the right branch without duplicating
  the path into the address bar.
- Ancestor rows are the way back up; there is no separate back button, and no
  horizontal breadcrumb, because the column is 220px wide.
- Counts are rolled up from descendants. `productCount` from the API counts
  only listings filed directly against a node, so almost every parent reports
  zero on its own. With branch filtering in place the rolled-up number now
  matches what clicking actually returns.
- Nothing is hidden for reading zero. A genuinely empty branch says zero
  honestly, and hiding branches would make the taxonomy change shape as stock
  moves.
- The whole tree is fetched in one request: the endpoint returns every level
  in a single Redis-cached response.

### Counts

Shown only for groups whose counts come from the server's facets — colours,
materials, styles, occasion, holiday, recipient, plus free-shipping and
on-sale. Groups without facet data (price, item type, rating, star seller)
show no number at all rather than a fabricated one.

Category is the exception: its numbers come from the category tree's own
`productCount`, rolled up over descendants, not from the search facets. They
therefore describe the whole catalogue rather than the current result set —
unlike every other count here, they do not shrink as other filters are
applied.

Two known limitations in the facet data itself, both server-side:

- `computeFacets` caps at the first 500 matching products, so on a result set
  larger than that every count is an undercount.
- Facets are computed with the same `where` as the results, including the
  group's own selection. Picking one material collapses the other materials
  in that group to zero. Standard faceted search excludes a group's own
  filter when counting that group.

Neither is fixed here; both need API changes.

### Celebration

The reference has a "Celebration" group listing Halloween, Christmas,
Mother's Day and so on. Those are the same values our Holiday facet already
carries, from `Product.holidayTags`. Merged into Holiday rather than
duplicated — one set of tags split across two headings gives the shopper two
places to look for one thing. Product decision, not reference parity.

## Not built — needs API or data that does not exist

Each of these appears in the reference and was left out for a concrete
reason, not for lack of time:

| Group | What is missing |
|---|---|
| Ready to dispatch in | No filter parameter for processing time. `Product.processingDays` exists; `SearchQueryDto` does not accept it. |
| Sent from / Deliver to | No country or city filter parameter, and no shipping-origin data on the product to filter by. |
| Sustainable features | No such field on the model. |
| Ordering options (gift wrap, gift cards) | No such fields on the model. |
| Item type: Vintage | No such field on the model. |

## Backlog

**Quick-filter chip row.** The reference has a horizontal strip of suggested
chips ("Funny", "Retro", "Witch"...) above the grid. These are keyword
suggestions generated from behavioural data we do not collect. Building it
needs a source of suggestions first — most likely popular tags or a
trending-search feed — not just the UI.

**Video on cards.** The reference shows a play button on some card images.
`Product.videoUrls` exists in the database but does not reach the client:
neither `ProductListItemDto` nor the list `include` carries it. Two pieces
were agreed and deliberately deferred:

- the play button, as in the reference, for touch devices and anyone not
  using a mouse;
- hover-autoplay on desktop, which is **not** in the reference and is our own
  addition — do not remove it as drift.

They must not fight each other: on a device with a real pointer the button
hides while the hover preview plays, so there is never a "play" control on
top of something already playing. Also needs `prefers-reduced-motion` to
disable autoplay, and a guarantee that only one video plays at a time.

Deferred because production currently has no published products, so there is
nothing to see and no way to verify any of it.

## Empty is not always broken

Two things on this page look like UI failures and are not. Check the data
before changing code.

**No colour swatches.** The swatch strip is implemented and wired to
`primaryColors`. All four listings currently live have `primaryColors = null`,
so there is nothing to draw. Set colour tags on a product and they appear.

**No rating line.** Also implemented — numeric average, stars, compact count.
It is hidden when a listing has no approved reviews, deliberately, because
"0 ★ (0)" reads as a bad score rather than as no data. All four current
listings have zero approved reviews.

**Pagination missing.** By design: `SearchPagination` returns null at
`totalPages <= 1`, and four results at 48 per page is one page.

## Backlog

**Header comparison.** The reference only captured the search field, so there
is not enough of it to judge the rest of the header against. Differences noted
so far, none of them yet decided:

| | Reference | Ours |
|---|---|---|
| Category entry | A single "Categories" button opening a mega menu | A row of category links, each with its own dropdown |
| Second row | Curated links (New Arrivals, Home Favourites, Vintage, ...) | The same category links as above |
| Right-hand icons | favourites, notifications, shop, avatar, basket | favourites, basket, language picker, sign-in |

The substantive difference is that the reference separates "browse the
taxonomy" from "curated entry points", while ours merges them into one row.
Needs a screenshot of the full header before deciding anything.

## Measured layout

From the reference images, by pixel analysis rather than estimate. Two
viewports were measured so the numbers are not over-fitted to one width:

| | @1280 | @1920 |
|---|---|---|
| Columns | 4 | 4 |
| Card width | 299px | 410px |
| Grid gap | ~15px | 22px |
| Content width | 1241px | 1706px |
| Side margin | ~20px | 107px |
| Image | 299 x 374 | 410 x 512 |

The image is **4:5 portrait at both widths** (374/299 = 1.251,
512/410 = 1.249). It was `aspect-square`, which is the single biggest reason
the grid did not look like the reference.

The container is **fluid with a cap**, not a fixed max-width: viewport minus
about 20px each side, capped near 1706px of content. A hard `max-w-[1400px]`
left 260px of dead margin on each side at 1920.

Gap is not constant across widths, so it steps: 16px, rising to 22px at 2xl.

Card text is **one line for the title**, and rating and shop share **one
line** — `4.8 ★ (329) By ShopName`. Fixed line counts are what keep a row of
cards aligned; a two-line title pushes one card's price and buttons below its
neighbours'.

## Seen in the reference, not built

Recorded from the 1280px captures. None of these are in progress.

| Element | Can we build it? |
|---|---|
| Quick-filter chip strip with horizontal scroll arrow | **No data.** Already decided against — these are keyword suggestions from behavioural data we do not collect. |
| "Etsy's Picks" strip above the grid (6 small cards + "See more") | **Partly.** We have `isFeatured` on Product, so an editorial strip is buildable, but nothing curates it today and the label would be ours. |
| "Did you mean the shop X?" line | **Partly.** Store search exists; nothing currently cross-searches shops from a product query. |
| "Digital download" label on digital cards | **Yes.** `ProductQueryDto` already has `itemType: 'digital'` and the product carries `productType`. Purely a card-rendering addition. |

One behavioural difference worth noting before anyone builds it: in the
reference the action row (`+ Add to cart` / `More like this`) is **always
visible**, on every card, not revealed on hover. Ours is hover-only. Not
changed yet — it affects how much vertical space every card needs.

## Star Seller badge — what it would take

The reference puts a small badge after the shop name on each card. We do not
render it, and the gap is not simply "no data" — it is that the two things
that could back it disagree.

`SearchQueryDto.starSeller` already exists as a filter, and the API resolves
it as `where.soldCount >= 50` — a **product-level** sales threshold
(`search.service.ts:540`). The reference badge is a **shop-level** status.
Filtering by "star seller" therefore currently means "this listing sold 50+",
not "this shop is a star seller", which is a different claim.

`Store` carries three fields that could serve a real shop-level badge:
`verifiedAt`, `rating`, `totalOrders`, plus an unused `scoreBadge` string.

To build the badge, in order:

1. Decide what earns it — verified, or a rating/volume threshold, or the
   existing `scoreBadge`. This is a policy decision, not an implementation
   one; putting a trust marker on a shop makes a promise to buyers.
2. Expose the resulting flag on the store fragment already embedded in
   `ProductListItemDto` (which today carries only `id`, `name`, `slug`).
3. Render it, and at the same time reconcile the `starSeller` filter so the
   filter and the badge mean the same thing. Shipping the badge while the
   filter still keys on product `soldCount` would leave two different
   definitions of the same word visible on one page.

## Digital-download label — blocked

The reference marks digital listings on the card. `Product.productType`
(`PHYSICAL | DIGITAL`) exists, and `SearchQueryDto` already accepts
`itemType: 'digital'` as a filter, so the concept is fully present server-side.

It cannot be rendered yet: `productType` is **not** in the API's
`ProductListItemDto` and none of the three mappers emit it, so it never
reaches the client. Note that `libs/shared/types` **does** declare
`productType?: 'PHYSICAL' | 'DIGITAL'` on the client-side type — a field that
is always `undefined` at runtime. Reading it and rendering nothing would look
like a styling bug rather than a missing field.

Needs `productType` added to `ProductListItemDto` plus the same three mappers
that `primaryColors` needed.
