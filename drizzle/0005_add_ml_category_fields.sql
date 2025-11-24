-- Add Mercado Libre category fields to categories table
ALTER TABLE categories ADD COLUMN "ml_category_id" TEXT UNIQUE;
ALTER TABLE categories ADD COLUMN "is_ml_official" BOOLEAN DEFAULT FALSE NOT NULL;

-- Create index for ml_category_id for faster lookups
CREATE INDEX "categories_ml_category_id_idx" ON categories("ml_category_id");
