-- Migration: Webhook Failures Table
-- Created: 2025-12-04
-- Purpose: Persistir webhooks fallidos para reprocesamiento manual

-- Crear enum para estados de webhook
CREATE TYPE webhook_status AS ENUM ('failed', 'retrying', 'success', 'dead_letter');

-- Crear tabla de webhooks fallidos
CREATE TABLE webhook_failures (
    id SERIAL PRIMARY KEY,
    payment_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    raw_body JSONB NOT NULL,
    headers JSONB NOT NULL,
    error_message TEXT,
    error_stack TEXT,
    client_ip TEXT,
    retry_count INTEGER DEFAULT 0 NOT NULL,
    status webhook_status DEFAULT 'failed' NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_retry_at TIMESTAMP,
    next_retry_at TIMESTAMP,
    processed_at TIMESTAMP
);

-- Índices para consultas eficientes
CREATE INDEX webhook_failures_payment_idx ON webhook_failures(payment_id, created_at DESC);
CREATE INDEX webhook_failures_retry_queue_idx ON webhook_failures(status, next_retry_at);
CREATE INDEX webhook_failures_status_idx ON webhook_failures(status);
CREATE INDEX webhook_failures_request_id_idx ON webhook_failures(request_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_webhook_failures_updated_at 
    BEFORE UPDATE ON webhook_failures 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentario sobre la tabla
COMMENT ON TABLE webhook_failures IS 'Almacena webhooks de Mercado Pago que fallaron validación HMAC para reprocesamiento manual';
COMMENT ON COLUMN webhook_failures.payment_id IS 'ID del pago de Mercado Pago asociado al webhook';
COMMENT ON COLUMN webhook_failures.request_id IS 'UUID único para correlación con logs';
COMMENT ON COLUMN webhook_failures.raw_body IS 'Payload JSON completo del webhook';
COMMENT ON COLUMN webhook_failures.headers IS 'Headers HTTP del request';
COMMENT ON COLUMN webhook_failures.status IS 'Estado actual: failed=recién fallido, retrying=en proceso, success=recuperado, dead_letter=irrecuperable';
