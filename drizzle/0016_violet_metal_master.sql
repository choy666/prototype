ALTER TABLE "product_variants" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "additional_attributes" jsonb;