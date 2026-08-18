-- Ezihubb Plus scope B: "Mixed grid" Featured-area layout.
--
-- Purely additive: one nullable TEXT column on an existing table. No DROP,
-- no RENAME, no NOT NULL without a DEFAULT, no data backfill needed — NULL
-- is read as 'grid' (the free/standard layout) everywhere in the app, so
-- every existing store keeps its current appearance with no migration of
-- rows at all.
--
-- Deliberately NOT a Postgres enum: the value set may grow with future
-- layouts, and adding a value to an enum needs its own migration whereas a
-- TEXT column validated at the application layer (@IsIn(['grid','mixed']))
-- does not. Matches how Store.colorTheme already stores its palette value.

-- AlterTable
ALTER TABLE "Store" ADD COLUMN "featuredLayout" TEXT;
