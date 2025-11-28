-- Agregar campos ME2 a productos
ALTER TABLE "products" 
ADD COLUMN "shipping_mode" varchar(20) DEFAULT 'me2',
ADD COLUMN "shipping_attributes" jsonb,
ADD COLUMN "me2_compatible" boolean DEFAULT false;

-- Agregar campos ME2 a categorías
ALTER TABLE "categories" 
ADD COLUMN "attributes" jsonb,
ADD COLUMN "me2_compatible" boolean DEFAULT false;

-- Crear índices para optimizar consultas ME2
CREATE INDEX "products_me2_compatible_idx" ON "products" ("me2_compatible") WHERE "me2_compatible" = true;
CREATE INDEX "products_shipping_mode_idx" ON "products" ("shipping_mode");
CREATE INDEX "categories_me2_compatible_idx" ON "categories" ("me2_compatible") WHERE "me2_compatible" = true;

-- Comentarios para documentación
COMMENT ON COLUMN "products"."shipping_mode" IS 'Modo de envío configurado para ME2 (me2, me1, drop_off)';
COMMENT ON COLUMN "products"."shipping_attributes" IS 'Atributos de envío específicos para ME2';
COMMENT ON COLUMN "products"."me2_compatible" IS 'Indica si el producto es compatible con Mercado Envíos 2';
COMMENT ON COLUMN "categories"."attributes" IS 'Atributos de la categoría desde ML API';
COMMENT ON COLUMN "categories"."me2_compatible" IS 'Indica si la categoría tiene atributos suficientes para ME2';
