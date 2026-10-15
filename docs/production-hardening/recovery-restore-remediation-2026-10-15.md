# Restore comparison remediation - 2026-10-15

Native run `38672319641` passed foundation, all 23 contention cases and the first
seven recovery cases. The final backup/restore drill restored PostgreSQL but
failed snapshot equality. Bounded diagnostics identified **constraints only**;
table data, sequences, columns, triggers, functions, indexes, enums and views
matched. No production deployment was performed from that failing candidate.

An independent disposable WASM PostgreSQL reproduction reparsed the 56 CHECK
constraints from the complete migration history. Six deparsed strings changed:
nested conjunctions flattened, and array-wide varchar-to-text casts became
element-wise casts. This is a parser-model reproduction, not native acceptance.

## Comparison policy

- Reparse each CHECK using PostgreSQL itself in an empty temporary table with
  the original column types. Apply the same operation to both snapshots.
- Use a separate session from the READ ONLY exported snapshot. Roll back the
  entire scratch transaction; never alter public tables, constraints or rows.
- Keep constraint names, types, every predicate/cast and non-CHECK definition.
  No regex-based SQL normalization, predicate removal or expected hash override.
- Continue exact comparison of all table hashes/counts, sequences and all other
  schema metadata. Retain fixed mismatch sections and bounded schema-identity
  diagnostics, never row values, raw SQL, private errors or credentials.
- Regression controls must reject changed money bounds, AND/OR grouping,
  allowed values, missing constraints and renamed constraints. Scratch tables
  must not survive rollback, and source public definitions must remain intact.

## Release scope

Local verification passed: 23 recovery contracts (including the entire migration
catalog round-trip and negative controls), M5 typecheck, zero-warning M5 lint and
`git diff --check`. Local Node is 24.14.0; native CI remains mandatory.

This is verification-harness work only. Production financial policy, money,
payments, feature gates, historical data and old migrations are unchanged.
Local checks do not substitute for fresh supported-runtime native CI, all four
exact-candidate Docker images or production post-rollout verification. This
document is not a deployment-success record or M5 paid-pilot GO.
