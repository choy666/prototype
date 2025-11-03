CREATE UNIQUE INDEX "product_attributes_name_unique" ON "product_attributes" USING btree ("name");--> statement-breakpoint
CREATE INDEX "product_attributes_name_idx" ON "product_attributes" USING btree ("name");--> statement-breakpoint
CREATE INDEX "product_variants_product_id_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variants_is_active_idx" ON "product_variants" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "product_variants_product_active_idx" ON "product_variants" USING btree ("product_id","is_active");--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "sku";