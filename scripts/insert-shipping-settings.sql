-- Ejecutar este SQL directamente en tu base de datos
-- para insertar la configuración inicial de envíos

INSERT INTO shipping_settings (
  business_zip_code,
  local_shipping_cost,
  local_shipping_radius,
  free_shipping_threshold,
  tiendanube_store_id,
  tiendanube_enabled,
  created_at,
  updated_at
) VALUES (
  '4700', -- CP del negocio (Salta)
  0, -- Envío local gratis
  10, -- Radio de 10 km
  5000, -- Envío gratis a partir de $5000
  '7078702', -- Store ID de Tiendanube
  true, -- Tiendanube habilitado
  NOW(),
  NOW()
);
