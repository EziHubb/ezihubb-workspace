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

### Counts

Shown only for groups whose counts come from the server's facets — colours,
materials, styles, occasion, holiday, recipient, plus free-shipping and
on-sale. Groups without facet data (price, item type, rating, star seller)
show no number at all rather than a fabricated one.

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
| Category | `category` is accepted by `SearchQueryDto`, but the reference renders a hierarchical drill-down and the sidebar has no category list to render. Needs a decision on flat list vs full hierarchy plus a category fetch — see the open question below. |
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
