# Plan de Integraciones Mercado Libre / Mercado Pago

Estado actualizado al 27/12/2025. Se documenta el alcance original por fases, el objetivo de cada una, tareas asociadas y el grado de avance observado en el repositorio.

## Resumen por fase

| Fase                                   | Objetivo                                                                         | Estado actual   |
| -------------------------------------- | -------------------------------------------------------------------------------- | --------------- |
| 1. Unificación OAuth / Config ML       | Centralizar configuración, exponer reautenticación y alertas de scopes           | **Completada**  |
| 2. Validaciones ME2                    | Extender reglas/logística ME2, advertencias y persistencia de atributos de envío | **Completada**  |
| 3. Variantes y atributos condicionales | Validar atributos obligatorios/condicionales y mostrar errores ML                | **Completada**  |
| 4. Listing type y precios              | Mantener listing type elegido y validar contra categoría                         | **Completada**  |
| 5. Webhooks & logística ML             | Validar firmas, procesar orders/shipments y DeadLetter                           | **Completada**  |
| 6. Checkout & post-pago                | Persistir datos MP, reaccionar a webhooks y validar shipping                     | **En progreso** |
| 7. Automatizaciones MCP                | Botones de diagnóstico ML/MP                                                     | **Completada**  |

---

## Detalle por fase

### 1. Unificación de configuración y OAuth ML (1.1-1.3)

- **Objetivo**: usar `getMercadoLibreConfig()` en auth/clients, permitir reautenticación proactiva y advertir si faltan scopes críticos.
- **Implementado**:
  - `lib/auth/mercadolibre.ts` y `lib/clients/mercadolibre.ts` consumen la configuración centralizada (`MERCADOLIBRE_CONFIG`).
  - Endpoint `POST /api/auth/mercadolibre/reauthorize` permite iniciar reautenticación (PKCE + estado) y se integra en el panel admin mediante el nuevo botón en `components/admin/MercadoLibreStatus.tsx`.
  - `GET /api/auth/mercadolibre/status` evalúa scopes (`CRITICAL_SCOPES`, `REQUIRED_SCOPES`) y expone módulos, motivos de reauth y scopes faltantes; la UI ahora muestra advertencias, badges por módulo y el CTA para reautorizar.
- **Estado final**:
  - Flujo documentado y validado en paneles críticos; las alertas de scopes se replican en creación/edición de productos y en la guía de atributos.
  - Escenarios de reautenticación manual y automática descritos en la documentación interna y confirmados en QA.
  - Se consolidan scopes provenientes tanto de `/users/me` como de `/applications/{app_id}`, quedando expuestos en la UI y disponibles para auditoría.

### 2. Validaciones ME2 (2.1-2.3)

- **Objetivo**: reforzar validaciones de dimensiones/peso según `getME2Config`, advertencias en UI y persistencia de `shippingAttributes` en productos.
- **Implementado**:
  - Nuevas utilidades en `lib/mercado-envios/me2Rules.ts`: `fetchMLAttributeDefinitions` y mejoras a `normalizeVariantAttributeCombinations`.
  - Endpoint `/api/admin/products/[id]/variants` normaliza y valida atributos antes de persistirlos, devolviendo advertencias al frontend.
  - `/api/mercadolibre/products/sync` reutiliza las combinaciones normalizadas y recalcula si faltan, abortando variaciones sin atributos oficiales.
- **Estado final**:
  - `validateProductForMLSync` y `isME2Ready` consultan dinámicamente `getME2Config.maxDimensions`, mostrando errores específicos por dimensión/peso.
  - `shippingAttributes` se persisten y viajan en el payload tanto en creación/edición de productos como en la sincronización con ML.
  - El formulario de logística despliega advertencias en tiempo real cuando se exceden límites o faltan campos obligatorios, bloqueando el envío si corresponde.

### 3. Variantes y atributos condicionales (3.1-3.2)

- **Objetivo**: asegurar que cada variante cumpla con los atributos obligatorios/condicionales de la categoría y traducir errores `item.attribute.missing_*` a alertas claras.
- **Estado final**:
  - `syncMLCategories()` almacena flags `required`, `tags`, `required_by` y restricciones condicionales de cada atributo.
  - `lib/validations/ml-sync-validation.ts` devuelve `missingRequired`, `missingConditional` e `invalidAttributes` referenciando ID y nombre legible.
  - En `MLAttributesGuide` se muestran badges contextuales, selectores “No aplica” respaldados por los `EMPTY_*_REASON` oficiales y alertas que enlazan al atributo faltante.
  - `POST /api/mercadolibre/products/sync` bloquea la publicación si faltan obligatorios o condicionales sin justificación y expone los detalles traducidos.
  - `MercadoLibreSyncPanel` y los toasts consumen el payload de errores, mostrando mensajes traducidos y agrupados por tipo de atributo.
  - Se añadieron pruebas unitarias/E2E para reglas condicionales y la documentación ahora incluye el flujo de resolución de atributos.

### 4. Listing type y precios (4.1-4.2)

- **Objetivo**: respetar la selección de listing type en el formulario y validar contra `categories/{id}.settings`.
- **Implementado**:
  - Los formularios de creación y edición consumen el endpoint enriquecido `/api/mercadolibre/listing-types`, muestran badges con la fuente (`Cuenta + categoría`, `Restricciones de categoría`, `Configuración del sitio`), deshabilitan tipos sin cupos y fuerzan la reselección si el tipo guardado queda bloqueado.
  - El backend (`POST /api/admin/products`, `PUT /api/admin/products/[id]`) reutiliza `validateListingTypeSelection` para verificar disponibilidad y rangos de precio antes de persistir, devolviendo `400` con el mensaje oficial y la fuente que lo bloquea.
  - El endpoint de sincronización `/api/mercadolibre/products/sync` dejó de elegir tipos “óptimos” automáticamente: ahora exige que el producto tenga `mlListingTypeId`, revalida contra los settings de la categoría y aborta con error descriptivo si la combinación precio + tipo no es admitida.
  - En el panel admin los toasts y banners de error muestran exactamente el mensaje devuelto por ML (ej. “El precio mínimo para GOLD_SPECIAL es 9.999 ARS”) junto con la recomendación de ajustar precio o elegir otro tipo.
- **Notas de soporte/QA**:
  - **Categorías sin cupos**: probar productos cuya categoría tenga tipos con `available = false` o `remainingListings = 0`. Escenario esperado: el formulario obliga a reseleccionar, el endpoint devuelve `400` con `source: user/category` y el sync aborta con el mismo mensaje.
  - **Rangos de precio**: ejecutar casos con precio por debajo y por encima de `priceRange.min/max`. Verificar que el frontend muestre la advertencia inmediata, que el POST/PUT rechace con el texto “El precio mínimo/máximo para … es …” y que el sync no envíe payloads hasta corregir el monto.
  - **Mensajes visibles para soporte**: los errores anteriores viajan en los toasts y logs de admin; soporte debe copiar literalmente el mensaje y sugerir ajustar precio o tipo según corresponda.
- **Estado**: Validaciones de UI + API + sync completas y escenarios de QA documentados; fase cerrada.

### 5. Webhooks & logística ML (5.1-5.3)

- **Objetivo**: validar firmas/user_id, procesar topics `orders`/`shipments` y usar `WEBHOOK_CONFIG` para reintentos/DeadLetter.
- **Implementado**:
  - `POST /api/mercadolibre/webhooks` ahora valida la firma HMAC (`lib/mercadolibre/webhook-security.ts`), aplica replay-guard (`webhook_replay_cache`), registra headers/raw body/estado en `mercadolibre_webhooks` y enruta `items`, `orders`, `shipments`, `questions` y `payments`. Cada evento actualiza su estado (`success`, `retrying`, `dead_letter`) conforme a `WEBHOOK_CONFIG`.
  - Se agregó `processShipmentWebhook` para sincronizar envíos: consulta `/shipments/{id}`, actualiza órdenes locales, tracking, agencia y genera historial en `shipment_history`. Esto cumple el requerimiento de procesar logística ML dentro del mismo pipeline.
  - Los reintentos/dead-letter comparten la utilería `webhook_failures`: cada fallo almacena headers/payload, incrementa `retryCount` y respeta las ventanas configurables (`ML_WEBHOOK_*`). Al superar `maxRetries`, el evento termina en dead letter con trazabilidad completa.
  - Migración `0010_enhance_ml_webhooks.sql` amplía la tabla `mercadolibre_webhooks` con `request_id`, `signature`, `headers`, `raw_payload` e índices para auditoría; se normalizan los estados históricos.
  - Los logs `[ML Webhook]` documentan firma valida, duplicados, procesamiento, retries y almacenamiento en dead letter, facilitando QA y soporte.
- **Notas de soporte/QA**:
  - Simular con payload oficial (MCP o CLI) para verificar: (1) rechazo por firma inválida, (2) replay ignorado, (3) reintentos hasta dead letter y (4) actualización de órdenes/shipment history al recibir `shipments`.
  - Confirmar que el dashboard `/api/admin/webhooks/summary` refleja los nuevos estados y que las columnas adicionales aparecen en las vistas admin.
- **Estado**: infraestructura y handlers completados, fase cerrada.

### 6. Checkout & post-pago (6.1-6.4)

- **Objetivo**: guardar `preference_id`/`init_point`, marcar órdenes como pagadas via webhook MP, validar shipping seleccionado y exponer botón de calidad MP.
- **Implementado**:
  - `POST /api/checkout` calcula costos ME2 reales, crea la orden local, arma la preferencia con `mpClient.createPreference` y persiste `preferenceId/init_point` junto a los metadatos de shipping y carrito (`mercadopagoPreferences`, `orders`). @app/api/checkout/route.ts#30-470
  - El webhook de Mercado Pago (`POST /api/webhooks/mercadopago`) valida firma HMAC, aplica fallback vía API cuando es necesario y enruta pagos/merchant orders de forma asíncrona. @app/api/webhooks/mercadopago/route.ts#1-338
  - `lib/actions/payment-processor.ts` consulta el pago en MP, registra el evento en `mercadopago_payments`, actualiza la orden (status, metadata, shipping) y ajusta stock cuando corresponde, reutilizando los datos de preferencia. @lib/actions/payment-processor.ts#1-750
- **Pendiente**:
  - El plan contemplaba un botón/flujo de “calidad MP” para auditar la integración; las acciones disponibles en `McpDiagnosticsPanel` solo cubren diagnósticos básicos y no invocan herramientas de calidad (`mcp2_quality_checklist`/`mcp2_quality_evaluation`). @components/admin/McpDiagnosticsPanel.tsx#124-248
  - Documentar en la UI post-pago el estado real del pago/webhook (actualmente solo se responde vía API), de modo que soporte/ventas dispongan de feedback inmediato cuando el webhook cae en fallback manual.

### 7. Automatizaciones con MCP (7.1)

- **Objetivo**: agregar botones de diagnóstico ML/MP que usen los servidores MCP (`mercadolibre-server.js`, `mercadopago-server.js`).
- **Implementado**:
  - Endpoint `POST /api/admin/mcp/execute` actúa como proxy seguro desde el dashboard y valida que solo administradores puedan invocar herramientas, aplicando timeouts y registrando logs en `logger`.
  - `lib/mcp/client.ts` levanta los servidores MCP vía `StdioClientTransport`, controla el timeout y trunca respuestas muy extensas antes de devolverlas al frontend.
  - Nuevo componente `McpDiagnosticsPanel` (panel principal del dashboard) agrupa acciones de ML y MP (`get_user_info`, `check_permissions`, `list_products`, `list_orders`, `get_payment_methods`, `search_payments`, `get_payment_details`, etc.). Cada botón indica el servidor correspondiente y permite ajustar parámetros dinámicamente.
  - Se muestran estados de carga, éxito y error directamente en los botones, y cada respuesta se guarda en un historial local (localStorage) con timestamp, duración, tool, resultado resumido y acceso a la respuesta completa.
- **Estado**: UI y backend completos, listado de herramientas desplegado, historial persistente y documentación actualizada. **Completada.**

---

## Recomendaciones generales

1. **Cerrar la fase 6** priorizando el botón de calidad MP (MCP) y el feedback post-pago en UI antes de habilitar nuevas campañas de checkout.
2. **Mantener staging sincronizado** con los escenarios de reautorización y pagos para validar el pipeline completo (checkout → preferencia → webhook → orden).
3. **Monitorear Webhooks/MP** con pruebas regulares de fallback HMAC para garantizar que los ajustes recientes sigan funcionando en producción.

## Material de ayuda oficial:

https://developers.mercadoenvios.com/?lang=es_ar
https://developers.mercadolibre.com.ar/es_ar/guia-para-producto
https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/overview
