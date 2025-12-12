-- Migration: Add business_settings table
-- Created: 2025-12-12
-- Description: Table to store business configuration for Nosotros and Envios sections

-- Create business_settings table
CREATE TABLE IF NOT EXISTS business_settings (
    id SERIAL PRIMARY KEY,
    business_name TEXT NOT NULL,
    description TEXT,
    zip_code VARCHAR(10) NOT NULL,
    address TEXT NOT NULL,
    phone_number VARCHAR(20),
    email VARCHAR(255),
    whatsapp VARCHAR(20),
    location JSONB, -- { lat: number, lng: number }
    schedule JSONB, -- { dias: [{ dia: string, abierto: boolean, horarios: string[] }] }
    social_media JSONB, -- { facebook: string, instagram: string, twitter: string, etc }
    images JSONB, -- [{ url: string, alt: string }]
    shipping_config JSONB, -- { freeShippingThreshold: number, internalShippingCost: number }
    purchase_protected BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS business_settings_zip_code_idx ON business_settings(zip_code);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_business_settings_updated_at 
    BEFORE UPDATE ON business_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default business settings
INSERT INTO business_settings (
    business_name,
    description,
    zip_code,
    address,
    shipping_config,
    purchase_protected
) VALUES (
    'Mi Negocio',
    'Descripción de tu negocio. Aquí puedes contar tu historia, misión y valores.',
    '1001', -- Código postal por defecto (CABA)
    'Dirección por defecto, Ciudad, País',
    '{"freeShippingThreshold": 30000, "internalShippingCost": 3000}',
    true
) ON CONFLICT DO NOTHING;
