-- CartItem.productId had no explicit onDelete, so Postgres defaulted to
-- RESTRICT — hard-deleting an archived product 500'd with a foreign key
-- violation whenever it was still sitting in someone's cart. Carts are
-- transient (unlike Order, which keeps a full purchase-time snapshot), so
-- cascading the delete is correct: a deleted product should just vanish
-- from any cart that still references it.
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_productId_fkey";
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
