#!/bin/bash
# Script para registrar carrier manualmente en Tiendanube

# Reemplaza con tu token real
ACCESS_TOKEN="TU_ACCESS_TOKEN"
STORE_ID="7089578"

curl -X POST "https://api.tiendanube.com/2025-03/${STORE_ID}/shipping_carriers" \
  -H "Authentication: bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Technocat-Integration/1.0 (contact@technocat.com)" \
  -d '{
    "name": "Envío Estándar",
    "code": "standard-shipping",
    "callback_url": "https://prototype-ten-dun.vercel.app/api/webhooks/tiendanube/shipping",
    "handling_fee": 0,
    "active": true
  }'
