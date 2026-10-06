# D001 — Identity and guest access contracts

Status: Option A approved by owner on 2026-10-02 ("duyệt, hãy tiếp tục đi"). Repository implementation and isolated verification authorized; not production activation, live provider operations or historical corrections. Implementation remains incomplete.

Original problem: R03 returned a full Google session despite local MFA. R04 guest messaging accepts ID-only access. R02 historical links may already belong to an unverified registrant. Cache-backed login lockout failed open during Redis outage.

E1 implementation 2026-10-02: Google redirect/GSI and all password roles now honor enabled MFA; clients handle challenges, redirect credentials use a URL fragment removed immediately, NextAuth revalidates bearer identity with the API. Refresh uses transactional conditional consumption; security Redis operations fail closed with 503, MFA attempt budgets and expiring challenge claims. Targeted 52 API tests and 6 Playwright cases pass; see progress.md. Guest capabilities, real PG/Redis/Google verification and historical ownership remain open. Redis data-loss/restart replay resistance is not proved by in-memory claim tests.

Options: (A) Google returns the same explicit challenge union as password login; guest threads use expiring, hashed capability tokens bound to a verified delivery channel; security counters fail closed with an explicit unavailable response. (B) disable affected Google/guest paths until a migration. (C) accept the current exposure (not recommended).

E2 follow-up verified locally 2026-10-03: anonymous messaging now requires mailbox proof and a hashed expiring/revocable cookie capability; account-owned threads never accept it. Composer and guest inbox support proof/recovery; reply emails use the guest inbox. Read/send/page/upload/preview/hide/report/read-receipt routes share the ownership gate; order associations enforce buyer and selected-shop ownership. Full API 425 tests and 8 mocked browser cases pass (see progress). Additive migration created, not applied. Real SMTP/DB/cookies, historical linking and private attachment delivery remain unverified/open; see guest-messaging-rollout.md. This supersedes E1's statement that guest capability code was still open.

Recommendation: A, with temporary restriction B if an exposed pilot is contemplated. Requires owner approval for response/error contracts, guest recovery UX and credential rotation. Do not automatically unlink historical data.

Advantages: uniform MFA and demonstrable guest ownership. Disadvantages: coordinated client/admin/shared API updates and link-recovery support; unavailable security backend reduces login availability.

Migration impact: additive guest capability storage; issue new links only after mailbox proof, expire old capabilities, separate old mislink investigation with audited cases. Deploy clients capable of MFA challenge before activating new Google response. No mass reassignment.

Rollback: disable the affected entry points, preserve issued capability records and audit trail; never restore ID-only authorization to recover UX.

Risk if postponed: Google MFA bypass and guest resource disclosure remain paid-pilot blockers. Internal testing must use synthetic accounts/data only.
