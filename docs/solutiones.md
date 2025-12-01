---

# 📌 **Prompt para Windsurf / Cascade — Corrección completa HMAC Mercado Pago**

```md
# Objetivo
Corregir completamente la validación HMAC de los webhooks de Mercado Pago en mi endpoint:
`POST /api/webhooks/mercadopago`

Actualmente, múltiples solicitudes están devolviendo `401 - Firma inválida`.  
Necesito que revises el código, detectes la causa raíz y generes una implementación 100% compatible con las reglas oficiales del API v1 de Mercado Pago.

# Problemas detectados (no repetir, pero sí considerar)
- Se reciben webhooks válidos, pero la firma HMAC no coincide.
- El `x-signature` está siendo parseado incorrectamente.
- El `string_to_sign` que se construye no coincide con el oficial.
- Se mezclan formatos legacy, alternativos y v1.
- Mercado Pago usa el formato v1 y mi servidor no lo está respetando.
- El manifest generado no es el que MP realmente firma.
- Se están intentando formatos alternativos de forma incorrecta.
- El webhook rechaza 100% de las solicitudes actuales.

# Especificación oficial que debe implementarse
Debe implementarse la validación EXACTA que exige Mercado Pago para webhooks API v1:

1. El header `x-signature` viene con el formato:
   `ts=12345,v1=HEX_HMAC`

2. El string_to_sign debe construirse con el siguiente formato literal:

```

id:{data.id};request-id:{x-request-id};ts:{ts}

```

3. La firma esperada debe calcularse así:

```

HMAC_SHA256(
message = string_to_sign,
secret = webhook_secret
)

```

4. Comparar `expectedSignature == receivedSignature` usando timing-safe comparison.

5. Si la firma NO coincide, devolver HTTP 401.

6. NO usar formatos legacy, ni fallback, ni mezclar formatos alternativos.

7. El body debe procesarse como **rawBuffer**, nunca como JSON parseado.

# Requerimientos estrictos
Generar:

- Código nuevo, limpio y reemplazo completo del validador.
- Parsing oficial y robusto del header `x-signature`.
- Extracción segura de `ts` y `v1`.
- Construcción exacta del string_to_sign especificado.
- Validación con HMAC SHA256.
- Comparación segura (constante-time).
- Manejo de errores controlado y logs claros.
- Rechazo inmediato con 401 si la firma no coincide.

# Entregables esperados
1. **Función completa validateMercadoPagoHmac(rawBody, headers, secret)**  
   → Devuelve { ok: true } o lanza error.

2. **Middleware / handler del webhook** implementado correctamente.

3. **Ejemplo real con request headers y body** mostrando cómo se valida.

4. **Logs profesionales** para debugging (sin filtrar información sensible).

5. **Explicación breve** del por qué la versión actual fallaba y cómo lo corregiste.

# Restricciones
- Usar Node.js / TypeScript.
- Usar únicamente crypto nativo (`import crypto from 'crypto'`).
- NO usar librerías externas para HMAC.
- NO alterar el payload.
- NO intentar firmar con formatos alternativos.
- NO mezclar v0/v1.
- Todo debe seguir exactamente la spec oficial de Mercado Pago API v1.

# Acción
Revisá todo el código actual, detectá la causa raíz exacta y generá la implementación corregida y final.

```

---
 
## Resultado implementación HMAC Mercado Pago

- **Función implementada**: `validateMercadoPagoHmac(rawBody, headers, secret)` en `lib/mercado-pago/hmacVerifier.ts`.
- **Headers usados**: `x-signature` con formato `ts=12345,v1=HEX_HMAC` y `x-request-id`.
- **string_to_sign literal**:

```text
id:{data.id};request-id:{x-request-id};ts:{ts}
```

- **Firma esperada**:

```text
HMAC_SHA256(message = string_to_sign, secret = MERCADO_PAGO_WEBHOOK_SECRET)
```

- **Comparación**: se compara `v1` contra la firma calculada usando `crypto.timingSafeEqual` (constant‑time).
- **Handler**: `/api/webhooks/mercadopago` lee el body como texto crudo (`req.text()`), construye `string_to_sign` con `data.id`, `x-request-id` y `ts`, valida la firma y devuelve `401` si es inválida.

### Ejemplo de validación

Request real (simplificado):

```http
POST /api/webhooks/mercadopago HTTP/1.1
Content-Type: application/json
x-request-id: 8f6a8e61-aaaa-bbbb-cccc-1234567890ab
x-signature: ts=1733092800,v1=4c9f...abcd

{"action":"payment.created","data":{"id":"1234567890"}}
```

string_to_sign construido en el servidor:

```text
id:1234567890;request-id:8f6a8e61-aaaa-bbbb-cccc-1234567890ab;ts:1733092800
```

La firma HMAC SHA256 de ese string, usando `MERCADO_PAGO_WEBHOOK_SECRET`, debe coincidir exactamente con el valor de `v1` del header `x-signature`.

### Causa raíz corregida

- El manifest anterior no coincidía con el formato oficial (incluía un `;` extra y podía usar IDs alternativos).
- Se mezclaban formatos legacy (`sha256=...`, IPN) con el formato v1 actual.
- Ahora solo se usa `data.id` + `x-request-id` + `ts` según la spec oficial v1.