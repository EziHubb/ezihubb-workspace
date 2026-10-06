# D004 — Truthful metric and feature contracts

Status: Option A approved by owner on 2026-10-02 ("duyệt, hãy tiếp tục đi"). Repository implementation and isolated verification authorized; not production activation, live provider operations or historical corrections. Implementation remains incomplete.

Problem: R14 returns synthetic views/trends/sources as measured values; R15 mixes shop and parent totals and has quantity bugs; R20 reports unprobed storage as healthy; R23 social publishing/newsletter subscription persistence is incomplete; R19 general preview is demo-scoped.

Options: (A) explicit availability/provenance in metric and health responses, unavailable UI states, and hide unsupported capability actions; (B) retain old numeric contracts but label estimates prominently; (C) implement real integrations before exposing them. Recommend A for pilot scope, C incrementally afterward. Zero is not a substitute for unknown observations.

Advantages: honest operator/buyer expectations and interpretable dashboards. Disadvantages: public/shared response shape changes and UI coordination. Owner must approve API compatibility, feature retirement and what seller revenue includes (items/shipping/tax/refund/discount).

Migration: version or expand contracts first, update all consumers, then remove synthesized output; preserve raw historical observations without fabricating missing data. Correct line quantity arithmetic is independent of fee policy, but a complete revenue subsystem needs D002 reconciliation and approved definitions.

E3a follow-up 2026-10-03: readiness is now measured for PostgreSQL, Redis, MongoDB and read-only storage access; separate process liveness and readiness routes, HTTP 503 when required probes fail/timeout/not configured. Deployment, Docker and smoke gate paths updated in repository only. Eleven new readiness tests include local HTTP and failure/timeouts/coalescing, inside the passing 436-test API suite. Real dependency outages, permissions, proxy behavior and deployment not verified. See readiness-contract.md. Synthetic analytics and unsupported commercial capability contracts remain open.

Rollback: preserve unavailable/estimate labels; do not reinstate fabricated measurements. No credentials or live newsletter/social publishing authorized.

Risk if postponed: sellers make decisions using fabricated metrics, readiness checks misrepresent dependency state and unsupported features appear operational.
