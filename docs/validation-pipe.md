# Validation: strict bodies, forgiving query strings

The global pipe treats request bodies and query strings differently. That
asymmetry is deliberate. It looks like a mistake and it is not — please read
this before making it uniform.

`apps/api/src/common/pipes/scoped-validation.pipe.ts`

## What it does

| | `whitelist` | `forbidNonWhitelisted` |
|---|---|---|
| Body (any method) | on | **on** — unknown field → 400 |
| Query string, production | on | **off** — unknown param dropped + logged |
| Query string, dev and CI | on | **on** — unknown param → 400 |

## Why query strings are lenient in production

`forbidNonWhitelisted` turns a single unrecognised parameter into a 400 for
the entire request. Callers routinely wrap those fetches in
`Promise.allSettled` or `.catch(() => [])`, so the 400 becomes an empty array
and a page section quietly renders nothing at all. Nothing is logged on
either side. It looks like "no data yet".

This has happened five times, each found by accident weeks later:

| Parameter | Endpoint | Effect while it lasted |
|---|---|---|
| `featured` | `/reviews` | Homepage reviews section missing |
| `isPersonalizable` | `/products` | "Personalisable ideas" strip missing |
| `collectionSlug` | `/products` | **Every collection page showed zero products** |
| `fields` | `/products` | No product page was ever pre-rendered |
| `limit=200` | `/products` | Same request, same effect |

Dropping the unknown parameter instead means the response is *wrong* rather
than *absent* — and wrong is louder, because something renders and can be
compared against expectations. The log makes it traceable rather than
depending on someone noticing.

The tradeoff is real: a mistyped parameter name now silently does nothing
instead of failing. That is why the strict behaviour is kept in dev and CI,
where a 400 is cheap and immediate.

**A wrong result can be worse than an empty one.** A collection page that
loses its `collectionSlug` renders every product on the platform and looks
completely normal. That is exactly why the log records what survived, not
only what was dropped.

## Why bodies stay strict

The opposite risk. A body field silently dropped is data the caller believes
it saved and did not — a mistyped field on a PATCH writes a partial record
with nothing to show for it. There is no "wrong but visible" version of that
failure; it is invisible either way. A 400 is the safe answer.

## Why it keys on parameter location, not HTTP verb

`ArgumentMetadata.type` is `'query' | 'body' | 'param' | 'custom'`, which is
what actually matters. A POST can carry query parameters, and a GET never has
a body, so keying on the verb would be both less precise and more code.

It also settles DELETE with no special case: its query is lenient, its body is
strict, like everything else.

Worth knowing: `GET /unsubscribe/cart?token=...` does write — it flips an
email preference, because unsubscribe links in emails have to be GET. It is
unaffected by any of this. The write is driven by `token`, a declared
parameter; an unknown extra parameter being dropped cannot change what it
writes.

## The log line

```
[unknown-query-param] ProductQueryDto — dropped: collectionSlug — kept: limit=24, isActive=true
```

`warn`, not `error`. The request succeeded, and burying the error level under
noise is how "error" stops meaning anything. `AxiomLoggerService` ships both
`warn` and `error`, so this reaches the log store rather than sitting in
container stdout.

It names the **DTO class**, not the URL. A pipe has no access to the request
without becoming request-scoped, which would be a real performance cost for a
line that should rarely appear — and the DTO name is the more directly useful
of the two anyway, since it is the file you have to edit.

## Alert to build (not built yet)

In Axiom, over the configured dataset (`AXIOM_DATASET`):

```
count() by bin_auto(_time)
| where message contains "[unknown-query-param]"
```

Alert when the count over a 5-minute window is greater than 0. It should
normally be exactly zero — every occurrence is a caller and a DTO that
disagree, which is a bug regardless of whether anything looks broken.

Sentry will not catch these: `Sentry.init` here has no log integration and
captures unhandled exceptions only.
