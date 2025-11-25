-- Add is_leaf field to categories table
-- This field indicates if a Mercado Libre category is a leaf category (can be used for product listing)

ALTER TABLE "categories" ADD COLUMN "is_leaf" boolean DEFAULT false NOT NULL;

-- Create index for better performance when filtering leaf categories
CREATE INDEX "categories_is_leaf_idx" ON "categories"("is_leaf");
