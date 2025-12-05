-- Migration: Add HMAC audit fields to mercadopago_payments
-- Description: Add fields to track HMAC validation failures and manual verification requirements
-- Date: 2025-01-05

-- Add new audit columns to mercadopago_payments table
ALTER TABLE mercadopago_payments 
ADD COLUMN IF NOT EXISTS requires_manual_verification BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS hmac_validation_result TEXT,
ADD COLUMN IF NOT EXISTS hmac_failure_reason TEXT,
ADD COLUMN IF NOT EXISTS hmac_fallback_used BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS verification_timestamp TIMESTAMP,
ADD COLUMN IF NOT EXISTS webhook_request_id TEXT;

-- Add index for efficient admin dashboard queries on manual verification flag
CREATE INDEX IF NOT EXISTS mp_payments_requires_manual_verification_idx 
ON mercadopago_payments(requires_manual_verification);

-- Add index for webhook request ID correlation
CREATE INDEX IF NOT EXISTS mp_payments_webhook_request_id_idx 
ON mercadopago_payments(webhook_request_id);

-- Add comment explaining the audit fields
COMMENT ON COLUMN mercadopago_payments.requires_manual_verification IS 'Indicates if payment requires manual admin verification due to HMAC validation failure';
COMMENT ON COLUMN mercadopago_payments.hmac_validation_result IS 'HMAC validation result: valid, invalid, or fallback_used';
COMMENT ON COLUMN mercadopago_payments.hmac_failure_reason IS 'Specific reason for HMAC validation failure';
COMMENT ON COLUMN mercadopago_payments.hmac_fallback_used IS 'True if API fallback was used due to HMAC failure';
COMMENT ON COLUMN mercadopago_payments.verification_timestamp IS 'Timestamp when payment was verified via API fallback';
COMMENT ON COLUMN mercadopago_payments.webhook_request_id IS 'Correlation ID with webhook_failures table for debugging';
