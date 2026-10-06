# Guest messaging capability rollout — E2

Status: implemented locally; service/controller and mocked browser checks pass as of 2026-10-03. Owner approved D001 Option A, not production rollout. No existing ownership, orders or money records modified. Additive migration created, not applied. See progress.md for measured totals and evidence limits.

## Public contract

- `POST /messages/guest-access/request`: email required; same response whether or not mailbox has threads/accounts. Eight-digit email proof, 15-minute TTL, three requests per mailbox per 15 minutes plus endpoint IP throttle. Strict Redis outage or unavailable delivery queue fails closed. A queued job is not a delivery guarantee.
- `POST /messages/guest-access/verify`: challenge ID plus code; at most five attempts. Conditional consumption permits one winning exchange. Raw proof is not stored in PostgreSQL; only SHA-256 of challenge ID plus code. Proof necessarily exists briefly in the delivery queue/email; completed/failed proof jobs removed.
- Success issues random 256-bit `guest_message_access` HttpOnly cookie, Secure in production, SameSite=Lax, path `/api/v1/messages`, 24-hour TTL. Database stores only token hash. No bearer token in response/URL/localStorage. This is not an account session.
- `GET /messages/guest-access` exposes only the authenticated capability's mailbox or null; `DELETE` revokes it and clears the cookie. `GET /messages/guest-conversations` lists only anonymous, visible threads for that mailbox.
- All customer conversation access (read/send/page/upload/preview/hide/report/read receipt) uses either authenticated account ownership OR trusted server-resolved guest capability. Body/query email is not authorization. Account identity takes precedence over guest cookie.
- Create/reopen requires proof matching the submitted guest email. Order context additionally requires actual order ownership, and a selected shop must be in that order.
- `/[locale]/messages/guest` supports mailbox proof/recovery and session revocation. Guest notification email links there without credentials. Threads already linked to an account require sign-in; no historical relinking.

## Isolated rollout checklist — not executed

1. Review/add migration `20261002060000_guest_message_access` to a disposable staging database with existing `nanoid(12)` function; verify table/index creation, generated-client compatibility and rollback constraints. Do not run migration commands against an unverified environment URL.
2. Deploy API/worker email template with the database expansion and coordinated client. Do not run a mixed API fleet where some nodes still authorize by conversation ID. Disable guest entry points during the transition if necessary; never restore the old authorization to hide a UX error.
3. Use synthetic mailboxes with real staging SMTP/queue. Verify delivery failure, retry timing, expiry, invalid/duplicate/concurrent codes and single-use semantics against real PostgreSQL. Redis must retain security counters; test outages explicitly.
4. Test actual HTTPS client/API domains and CORS/origin configuration, cookie parsing, credentialed fetch, SameSite behavior, Secure/path/HttpOnly flags. Local Playwright network mocks do not validate cross-domain cookies or SMTP.
5. Test guest A/B, signed account A/B, shop A/B, associated/unrelated orders, all message routes and logout/session expiry on desktop/mobile. Ensure private HTTP responses and CDN rules do not cache conversations publicly.
6. Keep old ownership unchanged. Investigate mislinks through separately authorized audited cases, not automated reassignment.

## Rollback and open limitations

Disable guest entry points if an operational failure occurs; preserve records and stop issuance. Never return to ID-only access or weaken mailbox proof. Do not drop the capability table during rollback while a live API depends on it.

- Real PostgreSQL concurrency, mail delivery, module boot with dependencies and HTTPS-cookie integration remain unverified.
- Existing public attachment URLs are not converted to private signed downloads; capability checks protect upload/history routes, not already disclosed URLs.
- Guest inbox currently polls for updates; account-only sockets/presence are not extended to guests.
- Mailbox owners can access all anonymous threads using that mailbox; no access to account-owned threads. Forwarding the verification email grants mailbox-level guest access for the issued session.
- Historical linking/merge races and retention cleanup need separate review. No cleanup cron introduced or historical records purged.
- Expired/revoked capability records cannot authenticate, but an operational retention policy and bounded database cleanup are still needed before scale. Browser cache/session cleanup on cross-tab identity changes needs full integration testing.
