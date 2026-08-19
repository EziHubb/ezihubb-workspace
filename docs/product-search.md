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
