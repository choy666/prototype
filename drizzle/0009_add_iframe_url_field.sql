-- Add iframeUrl field to business_settings table
ALTER TABLE business_settings ADD COLUMN iframe_url text;

-- Add comment to describe the field
COMMENT ON COLUMN business_settings.iframe_url IS 'URL del iframe para mostrar en página nosotros';
