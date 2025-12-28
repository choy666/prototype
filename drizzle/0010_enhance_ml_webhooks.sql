-- Mejora del almacenamiento de webhooks de Mercado Libre:
-- - Se agregan campos para request_id, firma, headers completos y raw payload
-- - Se añade columna status usando webhook_status enum para reflejar retries/dead letter
-- - Se crea índice para request_id y se actualizan registros existentes

ALTER TABLE "mercadolibre_webhooks"
  ADD COLUMN IF NOT EXISTS "request_id" text,
  ADD COLUMN IF NOT EXISTS "signature" text,
  ADD COLUMN IF NOT EXISTS "headers" jsonb,
  ADD COLUMN IF NOT EXISTS "raw_payload" text,
  ADD COLUMN IF NOT EXISTS "status" webhook_status DEFAULT 'retrying';

UPDATE "mercadolibre_webhooks"
SET "status" = CASE
  WHEN COALESCE("processed", false) = true THEN 'success'
  WHEN COALESCE("error_message", '') <> '' THEN 'failed'
  ELSE 'retrying'
END
WHERE "status" IS NULL;

ALTER TABLE "mercadolibre_webhooks"
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'retrying';

CREATE INDEX IF NOT EXISTS "ml_webhooks_request_id_idx"
  ON "mercadolibre_webhooks" ("request_id");
