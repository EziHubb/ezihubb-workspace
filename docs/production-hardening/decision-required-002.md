# D002 — Financial authority, allocations and historical reconciliation

Status: Option A approved by owner on 2026-10-02 ("duyệt, hãy tiếp tục đi"). Repository implementation and isolated verification authorized; not production activation, live provider operations or historical corrections. Implementation remains incomplete.

Problem: R07 unpaid online orders create immediately withdrawable ledger credits. R09 refunds and cancellation lack coherent per-shop economic reversal. R13 lacks explicit test provenance; R16 ordinary referrals can accrue advertising fees. R24 partial affiliate payout marks all confirmed commissions paid. Fixing these changes seller payout/fee semantics and reinterprets existing records.

Options: (A) captured-money ledger with immutable per-shop allocation, pending/reserved/available buckets, explicit payout-entry allocation and adjustment debts; (B) delivery/release-based eligibility with the same immutable allocation and additional hold policy; (C) keep current eligibility. Recommend A for pilot, but owner must decide capture vs delivery hold, refund fee policy, shipping subsidy allocation, affiliate partial allocation and evidenced ad-attribution rules before activation.

Advantages: traceable conservation of money and reliable payout/reversal. Disadvantages: migrations, reconciliation, seller-facing balance changes and possible historical negative balances. No rate or policy changed in this pass; conditional affiliate updates only prevent duplicate existing effects.

Migration: add origin/payment references, allocation rows and test provenance separately from order lifecycle. Snapshot old balances; reconcile provider captures/refunds/payout transfers against each Order/StoreOrder/ledger entry; produce exceptions before any correction. Backfill only approved cases with append-only adjustments, never overwrite/delete financial history. No live provider access authorized.

Rollback: freeze new payout requests/dispatch, retain new allocations and all adjustments, investigate exceptions; never erase real transfer records. Feature rollback is not financial rollback.

Risk if postponed: unsupported seller balances, overpayment, wrong refund liabilities and misleading finance reports. Do not activate online money flows or paid pilot on current semantics.
