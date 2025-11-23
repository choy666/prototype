-- Migración para agregar soporte de modos de envío de Mercado Libre
-- Reemplaza la tabla genérica shipping_methods por estructura específica para ML

-- Crear nueva tabla para modos de envío de Mercado Libre
CREATE TABLE IF NOT EXISTS "ml_shipping_modes" (
	"id" serial PRIMARY KEY NOT NULL,
	"ml_mode_id" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Crear índice único para ml_mode_id
CREATE UNIQUE INDEX IF NOT EXISTS "ml_shipping_modes_ml_mode_id_unique" ON "ml_shipping_modes" ("ml_mode_id");

-- Insertar modos de envío principales de Mercado Libre para Argentina
INSERT INTO "ml_shipping_modes" ("ml_mode_id", "name", "description", "is_active") VALUES
('me1', 'Mercado Envíos 1', 'Envío estándar con retiro en correo', true),
('me2', 'Mercado Envíos 2', 'Envío a domicilio completo', true),
('me3', 'Mercado Envíos Flex', 'Envío flexible con puntos de retiro', true),
('custom', 'Envío Personalizado', 'Configuración personalizada de envío', true);

-- Agregar columnas a la tabla orders para integración con ML
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "mercado_libre_shipment_id" varchar(50);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "mercado_libre_address_id" varchar(50);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "mercado_libre_shipment_status" varchar(50);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "mercado_libre_shipment_substatus" varchar(50);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_mode" varchar(20) DEFAULT 'me2';

-- Crear índices para las nuevas columnas
CREATE INDEX IF NOT EXISTS "orders_mercado_libre_shipment_id_idx" ON "orders" ("mercado_libre_shipment_id");
CREATE INDEX IF NOT EXISTS "orders_shipping_status_idx" ON "orders" ("shipping_status");
CREATE INDEX IF NOT EXISTS "orders_shipping_mode_idx" ON "orders" ("shipping_mode");

-- Crear tabla para historial de estados de envío
CREATE TABLE IF NOT EXISTS "shipment_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" varchar(255) NOT NULL,
	"shipment_id" varchar(50),
	"status" varchar(50) NOT NULL,
	"substatus" varchar(50),
	"comment" text,
	"tracking_number" varchar(100),
	"tracking_url" text,
	"date_created" timestamp NOT NULL,
	"source" varchar(50) DEFAULT 'mercadolibre',
	"created_at" timestamp DEFAULT now() NOT NULL,
	FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Crear índices para shipment_history
CREATE INDEX IF NOT EXISTS "shipment_history_order_id_idx" ON "shipment_history" ("order_id");
CREATE INDEX IF NOT EXISTS "shipment_history_shipment_id_idx" ON "shipment_history" ("shipment_id");
CREATE INDEX IF NOT EXISTS "shipment_history_status_idx" ON "shipment_history" ("status");
CREATE INDEX IF NOT EXISTS "shipment_history_date_created_idx" ON "shipment_history" ("date_created");

-- Crear tabla para configuración de webhooks de envíos
CREATE TABLE IF NOT EXISTS "shipment_webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" varchar(50) NOT NULL,
	"user_id" varchar(50) NOT NULL,
	"topic" varchar(50) NOT NULL,
	"resource_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_processed" timestamp,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Crear índices únicos para webhooks
CREATE UNIQUE INDEX IF NOT EXISTS "shipment_webhooks_application_user_topic_unique" ON "shipment_webhooks" ("application_id", "user_id", "topic");

-- Actualizar el tipo de dato de shipping_status para incluir nuevos estados
ALTER TABLE "orders" ALTER COLUMN "shipping_status" TYPE varchar(50) USING "shipping_status"::varchar(50);

-- Crear trigger para actualizar updated_at en ml_shipping_modes
CREATE OR REPLACE FUNCTION update_ml_shipping_modes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER "ml_shipping_modes_updated_at" BEFORE UPDATE ON "ml_shipping_modes" FOR EACH ROW EXECUTE FUNCTION update_ml_shipping_modes_updated_at();

-- Crear trigger para actualizar updated_at en shipment_webhooks
CREATE OR REPLACE FUNCTION update_shipment_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER "shipment_webhooks_updated_at" BEFORE UPDATE ON "shipment_webhooks" FOR EACH ROW EXECUTE FUNCTION update_shipment_webhooks_updated_at();

-- Comentarios descriptivos
COMMENT ON TABLE "ml_shipping_modes" IS 'Modos de envío disponibles de Mercado Libre (ME1, ME2, ME3)';
COMMENT ON COLUMN "ml_shipping_modes"."ml_mode_id" IS 'Identificador del modo de envío en Mercado Libre';
COMMENT ON COLUMN "orders"."mercado_libre_shipment_id" IS 'ID del shipment en Mercado Libre';
COMMENT ON COLUMN "orders"."mercado_libre_address_id" IS 'ID de la dirección de envío en Mercado Libre';
COMMENT ON COLUMN "orders"."mercado_libre_shipment_status" IS 'Estado del shipment según API de Mercado Libre';
COMMENT ON COLUMN "orders"."mercado_libre_shipment_substatus" IS 'Subestado detallado del shipment';
COMMENT ON COLUMN "orders"."shipping_mode" IS 'Modo de envío utilizado (me1, me2, me3)';
COMMENT ON TABLE "shipment_history" IS 'Historial de cambios de estado de los envíos';
COMMENT ON TABLE "shipment_webhooks" IS 'Configuración de webhooks para notificaciones de envíos';
