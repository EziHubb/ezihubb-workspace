# M5.3 — HTTPS boundaries and provider sandbox

Updated 2026-10-08. **Partial implementation; full-stack/native/provider acceptance BLOCKED.**
This checkpoint does not close M5.3. M5.1/M5.2 native acceptance is still absent.

## Implemented in this checkpoint

1. `api:m5-https-test` starts a real Nest HTTPS listener on an ephemeral loopback
   port. Its RSA certificate/key are created in memory, expire after one hour,
   have only localhost/127.0.0.1 SANs and are never written or globally trusted.
   Requests validate TLS with that specific certificate, not `rejectUnauthorized:
   false`. Wrong trust is explicitly rejected; sockets close and requests time out.
2. Actual production controllers, Passport strategies, JWT signatures, session
   validation, role/origin guards, store-context resolver, DTO validation and
   Stripe SDK raw-body signature verification run without guard overrides.
   Synthetic storage supplies session/account records; financial/refund handlers
   and refresh rotation are modeled. The actual AuthService cookie writer is used.
   This is **not AppModule, native session rotation or a browser cookie jar**.
3. CORS options moved unchanged into `apiCorsOptions`, used by both main bootstrap
   and HTTPS tests. Allowed/denied origins, credentialed preflight, exposed headers,
   cache TTL and the production wildcard prohibition remain unchanged. CORS denial
   omits permission headers; it is not a substitute for CSRF authorization.
4. A separate strict sandbox manifest and bounded read-only provider preflight:
   `api:m5-sandbox-doctor` does no network I/O; `api:m5-sandbox-probe` reads Stripe
   account/webhook endpoint and PayPal sandbox OAuth/webhook configuration only.
   No capture/refund/transfer/webhook creation, endpoint update or app activation.
   It requires source-bound completed native M5.1 **and** M5.2 evidence first.
5. Sandbox guard/evidence tests and explicit uncached Nx targets. The existing
   manually invoked isolated CI workflow runs contract tests without provider
   secrets. It does not run the external probe, deploy or publish a webhook.

## HTTPS contract matrix

The fixed suite has 34 named test cases:

- Trusted HTTPS success and rejection of an unrelated certificate.
- Missing/incorrect/expired JWT, MFA partial token and forged role headers.
- Signed CUSTOMER/ADMIN denied platform payments; deleted account, revoked
  session, changed role and globally revoked legacy token denied before readers.
- First-party credentialed CORS and denied origin without a permission header.
- Foreign origin, lookalike origin and `Origin: null` cookie-refresh CSRF;
  Referer fallback and invalid refresh cookie denied before rotation.
- Production HttpOnly/Secure/SameSite=None refresh cookie at `/api/v1/auth`.
- Original signed Stripe JSON body accepted; missing signature, tampering,
  expired signature and JSON reserialization rejected before handlers.
- Retryable versioned Stripe/PayPal failures return 503, not false success.
- Unverified PayPal event cannot call settlement; legacy 200 acknowledgement is
  **not** verification or financial success. PayPal verification is modeled here.
- Signed non-super-admin gift-wrap approval denied; own-store and foreign-store
  contexts cannot act platform-wide; forged audit/proof fields rejected.
- Verified platform JWT supplies the gift-wrap/shipping approver; exact shipping
  minor units passed to the service. Booking/provider effects remain modeled.
- Credentialed preflight headers/TTL and rejection of wildcard production CORS.

## Private sandbox setup and authority

Use [sandbox.env.example](../../scripts/m5/sandbox.env.example) as the template for
the ignored `.env.m5-sandbox.local`. Do not use `.env`, real production resources,
LIVE credentials or share secrets in chat. No private manifest was created here.
PayPal credentials must belong to a separate sandbox application. Stripe keys
must start `sk_test_`; webhook response must explicitly have `livemode: false`.
The expected Stripe account and both original webhook IDs/URLs must match.
The dedicated public HTTPS hostname must start `m5-` or `m5.` and have no port,
credentials, query, fragment or non-root path; ordinary production API domains
and loopback/non-public `.test` hosts are rejected.

The manifest is deliberately **not** loaded by AppModule, Prisma, Docker or the
foundation runner. It cannot carry DATABASE_URL, app activation gates, arbitrary
endpoints, TLS bypasses or ambient startup commands. A hostname convention and
provider reads do not prove deployment isolation; a separately provisioned stage
and its DB/queue/storage identity still need verification before financial tests.

After establishing the baseline and actual native evidence for this exact source:

```text
pnpm nx run api:m5-https-test --skipNxCache
pnpm nx run api:m5-sandbox-test --skipNxCache
pnpm nx run api:m5-sandbox-doctor --skipNxCache
# Only once separate sandbox accounts/HTTPS stage are assigned:
pnpm nx run api:m5-sandbox-probe --skipNxCache
```

The probe only calls fixed official API hosts/paths over validated TLS >=1.2;
it never follows redirects, downloads a PayPal cert URL or prints raw provider
responses/errors. Ambient TLS bypass/extra-CA/startup overrides are rejected;
POST is denied everywhere except the exact PayPal client-credentials grant.
Request deadline 15 seconds, response cap 1 MiB. Only the PayPal
OAuth request is POST; it requests an access token, not a monetary operation.
Artifacts contain whitelisted outcomes/source fingerprints, not keys/cookies/raw
bodies. They are local unsigned diagnostics, not remote attestations. Even a
successful probe retains `fullStackVerified: false`, `sandboxVerified: false`,
`webhookDeliveryVerified: false`, `signingSecretVerified: false` and
`paypalMerchantVerified: false`. No probe can close M5.3.

## Remaining acceptance, fixed scope

| Gate | What must run on the assigned isolated stage | Current status |
|---|---|---|
| Native prerequisites | Node >=24.15 <25; Docker stack, migrations and all 23 M5.2 cases for this source | BLOCKED; no accepted M5.1/M5.2 native reports |
| Full AppModule auth/session | Real login/MFA, Redis counters, DB refresh rotation/replay, revoke current/all sessions, tenant boundaries and OAuth origin/callback routing over HTTPS | NOT IMPLEMENTED/RUN as a native full-stack driver; contract coverage above only |
| Guest mailbox identity | Actual queue worker → local Mailpit message → code verification → HTTPS cookie/replay/expiry → guest conversation isolation | NOT IMPLEMENTED/RUN as a mailbox driver; existing synthetic regression is not delivery |
| Browser state/cookies | Real client/admin against native API, no route mocks; account/guest checkout reload, locale/state retention, Secure cookie and CORS behavior on desktop/mobile | NOT IMPLEMENTED/RUN as a full-stack browser suite; existing mock E2E cannot close this |
| Stripe TEST | Original-order checkout/capture, signed delivered callback and duplicate/out-of-order replay; native capture/ledger/refund allocations; lost-response original-resource lookup; account/amount/currency/mode rejection | NOT RUN; needs sandbox account and reachable registered HTTPS endpoint; only binding/contract harness is implemented |
| PayPal sandbox | Payer approval/capture, actual signature verification, original capture merchant/amount/currency checks, delivered callback/replay and original refund lookup | NOT RUN; needs sandbox business/buyer/app/webhook; modeled verification is insufficient |
| Cross-layer evidence | Original provider IDs reconciled with immutable context/capture/journal/lots/refunds, masked artifacts, TEST excluded from LIVE | NOT RUN; no synthesized financial acceptance allowed |

These are the original M5.3 gates, not new M5 milestones. Provider financial
operations, assigning an externally reachable stage and its isolated activation
require the missing environment/account authority, not automatic use of production.
Failure/restore drills remain M5.4; release remains M5.5 and separate approval.

## Source references

Signature tests follow [Stripe's raw-body signature requirements](https://docs.stripe.com/events/manage-webhook-endpoints#signature-errors).
PayPal [postback verification](https://developer.paypal.com/api/rest/webhooks/rest/)
requires real event evidence; simulator events are not equivalent to sandbox
financial delivery ([simulator limitations](https://developer.paypal.com/api/rest/webhooks/simulator/)).

## Measured verification

| Check | Result and limit |
|---|---|
| `api:m5-https-test` | 34/34 PASS, uncached, 23.103 s; genuine loopback TLS/JWT/signatures with synthetic storage/provider handlers |
| `api:m5-sandbox-test` | 18/18 PASS, uncached; modeled binding/evidence checks, no external provider I/O |
| Targeted auth/guest/finance/payment regressions | 8 suites / 119 tests PASS, uncached, 57.746 s; includes the 34 HTTPS tests, not additive |
| M5.1/M5.2 harness regressions | 39/39 and 10/10 PASS, uncached; PGlite/model contracts, NOT native PostgreSQL acceptance |
| M5 lint/typecheck and API typecheck | PASS; harness lint zero warnings |
| API lint | PASS, 0 errors / 175 warnings; unchanged budget and warning count |
| Production API build | PASS, uncached, webpack compile 40.819 s; not an application boot or deployment |
| Full API regression | 90 suites / 889 tests PASS, uncached, 1168.039 s; includes the 34 HTTPS cases and overlapping targeted regressions, not additive |
| Native prerequisites/full-stack/browser/mailbox/provider delivery | BLOCKED/NOT RUN |

Local doctor `artifacts/m5/ee9bc8f0a7d400c2f1a44af9.json` correctly records BLOCKED
for Node 24.14.0, absent matching foundation/contention evidence and missing
separate sandbox manifest; ambient TLS/startup check PASS. `providerNetworkAttempted`
is false. This is diagnostic, not acceptance. No provider network operation or
stage deployment has been performed. `git diff --check` PASS. Initial HTTPS test
failures were corrected in the synthetic certificate/DTO fixtures; assertions,
TLS validation and authorization guards were retained, not disabled.

Owner requested on 2026-10-08: continue with M5.4 **after M5.3 is complete**.
That acceptance dependency is retained. The later explicit M5.4 implementation
request allows the independent local recovery harness documented in
[m5-recovery.md](m5-recovery.md); it does not close M5.3 or grant M5.4 acceptance.
