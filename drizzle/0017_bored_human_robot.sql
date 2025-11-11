ALTER TABLE "product_variants" ALTER COLUMN "attributes" DROP NOT NULL;
ALTER TABLE "product_variants" DROP COLUMN "attributes";
