ALTER TABLE orders
  ADD COLUMN shipping_quote_key text,
  ADD COLUMN shipping_cart_id text,
  ADD COLUMN shipping_carrier_id text,
  ADD COLUMN shipping_carrier_name text,
  ADD COLUMN shipping_quote_source text,
  ADD COLUMN shipping_quote_expires_at timestamp;

CREATE INDEX IF NOT EXISTS orders_shipping_quote_key_idx ON orders (shipping_quote_key);
CREATE INDEX IF NOT EXISTS orders_shipping_cart_id_idx ON orders (shipping_cart_id);
