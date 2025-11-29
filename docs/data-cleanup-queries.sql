-- Consultas de diagnóstico para limpieza de datos históricos
-- IMPORTANTE: este archivo solo contiene SELECTs (sin UPDATE/DELETE)
-- Ejecutar siempre primero en un entorno de pruebas o con transacciones manuales.

-- 1) Detectar payment_id duplicados en la tabla de órdenes
SELECT
  payment_id,
  COUNT(*) AS order_count
FROM orders
WHERE payment_id IS NOT NULL
GROUP BY payment_id
HAVING COUNT(*) > 1
ORDER BY order_count DESC, payment_id;

-- 2) Ver detalle de órdenes para cada payment_id duplicado
WITH duplicates AS (
  SELECT
    id,
    payment_id,
    user_id,
    status,
    total,
    stock_deducted,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY payment_id
      ORDER BY created_at ASC
    ) AS rn
  FROM orders
  WHERE payment_id IS NOT NULL
)
SELECT
  payment_id,
  id       AS order_id,
  user_id,
  status,
  total,
  stock_deducted,
  created_at,
  rn       AS order_rank_for_payment
FROM duplicates
WHERE payment_id IN (
  SELECT payment_id
  FROM orders
  WHERE payment_id IS NOT NULL
  GROUP BY payment_id
  HAVING COUNT(*) > 1
)
ORDER BY payment_id, rn;

-- 3) Resumen de stock vs cantidad comprometida en órdenes con stock_deducted = true
--    Esto permite detectar productos donde el stock actual podría estar desajustado.
SELECT
  p.id   AS product_id,
  p.name AS product_name,
  p.stock AS current_stock,
  COALESCE(SUM(oi.quantity), 0) AS ordered_quantity_with_stock_deducted
FROM products p
LEFT JOIN order_items oi
  ON oi.product_id = p.id
LEFT JOIN orders o
  ON o.id = oi.order_id
 AND o.stock_deducted = TRUE
 AND o.status IN ('paid', 'shipped', 'delivered')
GROUP BY p.id, p.name, p.stock
ORDER BY p.id;

-- 4) Órdenes con stock_deducted = true pero en estado no final (posible inconsistencia)
SELECT
  id        AS order_id,
  user_id,
  status,
  total,
  stock_deducted,
  created_at,
  payment_id
FROM orders
WHERE stock_deducted = TRUE
  AND status NOT IN ('paid', 'shipped', 'delivered', 'cancelled', 'rejected')
ORDER BY created_at DESC;
