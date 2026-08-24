-- Restores the sequence behind OrdersService.generateOrderNumber(), which runs
-- SELECT NEXTVAL('order_number_seq') to build "MLH-<year>-<00001>".
--
-- It went missing when the 32-migration history was squashed into
-- 20260823060000_init. That file was generated with `prisma migrate diff
-- --from-empty --to-schema`, which emits DDL derived from schema.prisma alone —
-- and a hand-created Postgres sequence does not appear in a Prisma schema. The
-- squash therefore dropped it silently, and rebuilding production from that
-- init produced a database with zero sequences. Every checkout then failed with
-- a 500 from the raw query, so no order could be placed at all.
--
-- The squash checklist in CLAUDE.md compares model and enum counts only; that
-- is what let this through. Sequences, functions, triggers and extensions are
-- invisible to it. This sequence is currently the only such object the code
-- depends on.

CREATE SEQUENCE IF NOT EXISTS order_number_seq;

-- Start above any order numbers already stored, so restoring a backup taken
-- before this migration cannot mint a duplicate — "Order"."orderNumber" is
-- UNIQUE, and a collision would fail the checkout transaction outright.
-- Rows whose number does not match the MLH pattern are ignored rather than
-- guessed at. `is_called => false` makes the next NEXTVAL return exactly this
-- value.
SELECT setval(
  'order_number_seq',
  COALESCE(
    (
      SELECT MAX(substring("orderNumber" FROM '^MLH-[0-9]{4}-([0-9]+)$')::bigint)
      FROM "Order"
      WHERE "orderNumber" ~ '^MLH-[0-9]{4}-[0-9]+$'
    ),
    0
  ) + 1,
  false
);
