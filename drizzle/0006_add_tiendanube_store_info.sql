-- Migration: Add store information fields to tiendanube_stores
-- Created: 2025-12-23
-- Description: Add fields to store store address, locations and currency info for shipping calculations

ALTER TABLE tiendanube_stores 
ADD COLUMN "name" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "country" VARCHAR(2),
ADD COLUMN "currency" VARCHAR(3),
ADD COLUMN "origin_address" JSONB,
ADD COLUMN "origin_zip_code" VARCHAR(10),
ADD COLUMN "locations" JSONB;

-- Add indexes for frequently queried fields
CREATE INDEX tiendanube_stores_country_idx ON tiendanube_stores("country");
CREATE INDEX tiendanube_stores_origin_zip_idx ON tiendanube_stores("origin_zip_code");

-- Add comment for documentation
COMMENT ON COLUMN tiendanube_stores.origin_address IS 'Origin address for shipping calculations: {street, number, city, state, zip_code, country}';
COMMENT ON COLUMN tiendanube_stores.locations IS 'Array of fulfillment centers/warehouses with addresses';
