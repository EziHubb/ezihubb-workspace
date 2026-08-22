-- Photo linking for variations: which variation group's options carry the
-- photos a shopper sees when they pick an option.
--
-- One nullable pointer per product rather than a boolean on each group, so
-- "two groups linked at once" cannot be represented. NULL means no group is
-- linked, which is the correct state for every product that exists today.
--
-- Deliberately NOT a foreign key. applyVariations() deletes every
-- VariationGroup and recreates it with the same id inside a single
-- transaction, so ON DELETE SET NULL would clear this pointer on every save
-- even when the group survives. The application nulls it explicitly, and only
-- when the group is genuinely gone.
--
-- Additive and nullable, so this is safe to run against live data: existing
-- rows get NULL and behave exactly as before.

ALTER TABLE "VariationSettings" ADD COLUMN "photoGroupId" TEXT;
