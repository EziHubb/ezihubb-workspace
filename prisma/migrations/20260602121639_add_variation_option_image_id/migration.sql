-- AddColumn: add imageId to VariationOption (soft reference to ProductImage.id)
ALTER TABLE "VariationOption" ADD COLUMN "imageId" TEXT;
