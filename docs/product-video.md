# Product video

Structured video on a product: the clip, its poster frames, and its duration.
Replaces the bare `Product.videoUrls String[]`, which could hold a URL and
nothing else.

## The reference shape, and why ours differs

The shape this was modelled on looks like this:

```json
"video": {
  "url": ".../ac_none,du_15,q_auto:good/<asset_id>.mp4",
  "thumbnail_urls": [
    ".../ar_1:1,c_fill,h_105,q_auto,w_105/<asset_id>.jpg",
    ".../q_auto/<asset_id>.jpg"
  ],
  "duration": "PT10S",
  "uploaded_at": "..."
}
```

Read the URLs, not just the keys. Every one of them is the **same asset id**
with a different transformation string in the path — `.../<transforms>/<id>.<ext>`
is a media-CDN URL. That system stores **one** upload and derives every
variant on request, so a list of thumbnail URLs costs nothing: it is string
concatenation, and a size nobody requests is never generated.

We store on R2/S3 behind a **static** CDN. There is no transform layer. So the
same JSON shape means something materially different here: each entry in
`thumbnailUrls` is a **real object** that upload has to generate and delete has
to clean up. Copying the shape without noticing that would have produced a list
of URLs that 404, because nothing would ever have created the files.

Consequences that follow from that, all of them deliberate:

- **Poster frames are generated at upload**, by ffmpeg, and stored. Two of
  them: a full-size frame at the clip's own aspect ratio for the gallery, and
  a 105px centre-cropped square for grid cards.
- **`thumbnailUrls` can be empty**, and callers must handle that. Clips that
  predate this feature have no poster, and extraction is best-effort. Consumers
  fall back to the product image; nothing indexes `[0]` blind.
- **Deleting a video deletes three objects**, not one.

## What is stored vs what is returned

| | Stored (`ProductVideo`) | Returned (`ProductVideoDto`) |
|---|---|---|
| duration | `durationSeconds Float?` | `duration: "PT10.4S" \| null` |
| posters | `posterUrl`, `posterSquareUrl` (nullable) | `thumbnailUrls: string[]` (possibly empty) |
| time | `createdAt` | `uploadedAt` (ISO 8601) |

Duration is **stored as a number** and converted to ISO 8601 only at the
response boundary. ISO 8601 is the right wire format — it is what
schema.org/VideoObject expects, so the field drops straight into video markup —
but it is the wrong storage format: `"PT10S"` cannot answer "clips under 5
seconds" without a string scan, and it loses the fractional precision ffprobe
gives us.

Both poster columns and the duration are **nullable on purpose**. Rows
backfilled from the old array have no poster and no measured duration, and
writing `0` there would be a lie that renders as a real value. Null means
"never measured" and the API passes that through as `null` rather than
inventing `PT0S`.

## `videoUrls` is deprecated, not removed

`Product.videoUrls` is still written, still returned, and still kept in step —
the upload writes the row and pushes to the array **in one transaction**, so
they cannot diverge on a partial failure. It is a mirror, not a second source
of truth: the per-product limit is counted off `ProductVideo` rows, never off
the array.

It stays because third-party integrations may be reading it, and breaking them
silently on a deploy is not a thing we get to find out about afterwards.
Removing it is a separate, announced migration.

## Upload path

One temp file is written per upload and shared by both tools. ffprobe and
ffmpeg each need a real seekable file — neither reads a container reliably from
a pipe, because both have to jump to the moov atom to find the stream layout.
Probing used to write its own copy; adding poster extraction on top would have
meant writing the same 20 MB buffer to disk twice per upload.

Poster extraction seeks ~1s in rather than taking frame 0, clamped to the
midpoint for very short clips. Opening frames are very often black or mid-fade,
which makes a poster that looks like a broken image.

Extraction failure does **not** fail the upload. A clip whose duration probed
fine but whose first frames will not decode still uploads, just without a
poster — a video that falls back to the product image is a better outcome than
a rejected upload.

Storage cleanup on delete runs **after** the row is gone and never inside the
transaction. An object-store timeout must not roll back a delete the caller
already saw succeed: a leaked object is cheap, a video that reappears after
being deleted is not.

## Limits

Enforced in the service, so every caller gets them — the partner API cannot get
a laxer deal than a human uploading through the dashboard.

| | |
|---|---|
| Formats | MP4, WebM, MOV |
| Max size | 20 MB |
| Max duration | 10s (+0.5s tolerance for encoder rounding) |
| Max per product | 2 |

## Partner API

Three routes on the existing partner surface, behind `ApiKeyGuard` +
`ApiKeyThrottlerGuard`, scoped to the key's own store via
`findByIdForStore` exactly like the image and digital-file routes:

```
GET    /partner/products/:id/videos
POST   /partner/products/:id/videos          multipart, field "video"
DELETE /partner/products/:id/videos/:videoId
```

A partner uploads **one file** and gets the poster URLs and duration back. It
never supplies thumbnails — those are derived server-side, so a partner cannot
attach an arbitrary image as the poster for a clip.

The POST returns the created `ProductVideoDto` alone, not the legacy
`{ url, videoUrls, video }` envelope the admin route still hands back. A new
API surface has no reason to inherit a deprecated field.

## Attaching a video that is hosted elsewhere

```
POST /partner/products/:id/videos/from-url
POST /admin/products/:id/videos/from-url
```

Takes the source payload verbatim — snake_case field names, unlike the rest of
the API, because the point is that a caller can pass what they already have
without reshaping it. The ValidationPipe whitelists by declared name, so these
names have to match the incoming spelling exactly or they would be stripped in
silence:

```json
{
  "url": "https://<allowed-host>/video/abc.mp4",
  "thumbnail_urls": ["https://<allowed-host>/abc_105.jpg", "https://<allowed-host>/abc.jpg"],
  "duration": "PT10S",
  "uploaded_at": "2026-08-09T07:52:56-04:00"
}
```

Nothing is fetched, uploaded or transcoded. The URLs are stored as given, so
none of it is verified: the duration is whatever the caller says, the poster is
whatever they point at, and the media can change or vanish afterwards without
us knowing. That is a fair trade for a trusted source and would not be for
arbitrary input — which is why the host allowlist is the gate, not a garnish.

### thumbnail_urls order is REVERSED between request and response

| | Order |
|---|---|
| Request `thumbnail_urls` | **[square, full-size]** |
| Response `thumbnailUrls` | **[full-size, square]** |

The request follows the source payload, which lists the small square crop
first. The response cannot: the gallery and the card both take index 0 as the
poster, and a 105px square stretched to gallery size looks like a broken image.
Reversing the response to match would have silently changed the poster on every
listing that already had one. The asymmetry is resolved once, in
`attachVideoFromUrl`, where the columns are named rather than positional.

### Host allowlist

`PARTNER_MEDIA_HOST_ALLOWLIST` — comma-separated hostnames. Matching is on the
full hostname and exact: `example.com` grants neither `sub.example.com` nor
`example.com.attacker.net`.

- **Unset** falls back to a seeded default (currently `v.etsystatic.com`).
- **Set but empty** denies everything, which is how you switch the endpoint off
  without a code change. `??` only falls back on an absent variable, so this
  distinction is real and deliberate.

Every URL in the payload is checked, posters included — a poster renders on the
card and the gallery exactly as the video does, so letting one in from an
unvetted host through a side door would defeat the gate.

Adding a host is a trust decision, not a config tweak: our product pages will
hotlink that infrastructure, so its operator controls whether the media stays
up, can serve different bytes later under the same URL, and sees a request from
every shopper who loads the page.

### Why URLs into our own storage are refused

Not tidiness. Deleting a video calls `storage.extractKey(url)` and removes the
resulting object, and `extractKey` returns the URL unchanged when it does not
recognise the host — so deleting an external video removes nothing. But a URL
pointing INTO our own CDN resolves to a real key. Without this check a partner
could attach another store's video URL to their own product, delete it, and
destroy that store's object. Anything in our storage must arrive through the
upload endpoint, which knows who owns it.

Deletion now also skips object storage entirely for any URL we do not host, via
`StorageService.isOwnStorageUrl`. That method must keep mirroring
`extractKey`: if they disagree we either leak an object we own or reach for one
we do not.

## Not done

- **`ProductListItemDto` still has no videos.** The search/grid payload carries
  neither `videoUrls` nor `videos`, so video-on-card (see
  `product-search.md`) is still blocked — but the blocker is now one field
  plus its mappers, and the poster it needs already exists.
- **No backfill of posters or duration for pre-existing clips.** Would need a
  batch job that re-downloads each stored object and runs ffmpeg over it.
  Those rows read as `thumbnailUrls: []`, `duration: null`.
- **No transcoding.** Whatever the seller uploaded is what gets served. Fine at
  10s and 20 MB; would need revisiting if either limit rose.
