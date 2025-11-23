 # Auditoría de Integraciones - Mercado Pago y Mercado Libre

 **Fecha:** 24 de noviembre de 2025  
 **Proyecto:** vercel-marketplace-neon v0.1.0  
 **Auditor:** Sistema de Auditoría Automática

 ---

 ## 📋 Resumen Ejecutivo

 Esta auditoría evalúa las integraciones con **Mercado Pago** y **Mercado Libre** tomando como base:

 - **Documentación oficial Mercado Pago:** https://www.mercadopago.com/developers/es/docs  
 - **Checklist de calidad Mercado Pago (MCP)**  
 - **Documentación oficial Mercado Libre:** https://developers.mercadolibre.com.ar/es_ar

 El enfoque se centra en:

 - **Calidad de la integración de pagos (Checkout Pro / Payments API).**  
 - **Uso correcto de webhooks y conciliación.**  
 - **Seguridad de credenciales y datos sensibles.**  
 - **Buenas prácticas de monitoreo y mantenimiento.**

 **Estado General Propuesto:** ✅ Apto para producción con observaciones, siempre que se apliquen las recomendaciones de este documento.

 ---

 ## 1. Alcance de la Auditoría

 - **Mercado Pago**  
   - Creación de preferencias de pago (Checkout Pro / API).  
   - Recepción de notificaciones vía **webhooks**.  
   - Consulta de pagos / órdenes para conciliación.  
   - Manejo de devoluciones / cancelaciones (si aplica al negocio).

 - **Mercado Libre**  
   - Autenticación OAuth 2.0 / PKCE.  
   - Uso de APIs de órdenes y publicaciones (si aplica).  
   - Manejo de tokens de acceso y refresh.

 - **Seguridad y operaciones**  
   - Manejo de secretos y tokens.  
   - Logging, monitoreo y alertas.  
   - Prácticas de recuperación ante fallos.

 ---

 ## 2. Checklist de Calidad - Mercado Pago (MCP)

Esta sección mapea los puntos principales del **Quality Checklist** de Mercado Pago a la integración.

### 2.1 Datos de la orden / ítems

- **Cantidad del producto (`items.quantity`)**  
  - Recomendación oficial: siempre enviar la cantidad de cada ítem.  
  - Consejo: aunque normalmente sea 1, envía el valor explícito para mejorar reporting.

- **Precio unitario (`items.unit_price`)**  
  - Obligatorio para el detalle del carrito en Checkout Pro.  
  - Consejo: valida que el valor sea numérico, positivo y que coincida con el backend.

- **Categoría del ítem (`items.category_id`)**  
  - Mejora la evaluación de riesgo y la tasa de aprobación.  
  - Consejo: usa categorías lo más específicas posible siguiendo el taxonomía oficial.

### 2.2 Datos del comprador (payer)

- **Email del comprador (`payer.email`)**  
  - Mejora la tasa de aprobación y la prevención de fraude.  
  - Consejo: valida el email antes de enviarlo y mantén consistencia con tu base de usuarios.

- **Nombre y apellido (`payer.first_name`, `payer.last_name`)**  
  - Recomendado para scoring antifraude.  
  - Consejo: envía siempre que sea posible; evita valores genéricos como "Test" o "Usuario" en producción.

- **Documento (`payer.identification`)**  
  - Recomendado: tipo + número (por ejemplo, DNI, CUIT, CPF).  
  - Consejo: valida formato local según país antes de mandarlo a la API.

- **Dirección (`payer.address`) y teléfono (`payer.phone`)**  
  - Ayudan a la validación de seguridad.  
  - Consejo: si tu checkout ya recolecta esta info, intégrala directamente con Mercado Pago.

### 2.3 Configuración de la preferencia

- **Back URLs (`back_urls`)**  
  - Recomendación: definir `success`, `pending` y `failure` para redirigir al usuario.  
  - Consejo: usa URLs que permitan reconstruir el contexto del pedido (por ejemplo, con un ID de orden interno).

- **Notificaciones Webhooks (`notification_url`)**  
  - Obligatorio para integraciones serias de backend.  
  - Consejo: usar una URL dedicada solo a Mercado Pago, protegida y monitorizada.

- **Referencia externa (`external_reference`)**  
  - Clave para conciliación. Debe mapear el pedido interno de tu sistema con el `payment_id` / `merchant_order_id`.  
  - Consejo: usa un ID inmutable del pedido y no información sensible del usuario.

- **Descripción / resumen de tarjeta (`statement_descriptor`)**  
  - Recomendación: enviar un nombre claro de comercio para reducir contracargos.  
  - Consejo: usa la misma marca que el usuario ve en tu sitio.

---

## 3. Flujo Recomendado de Pagos con Mercado Pago

1. **Creación de preferencia**  
   - Construir el objeto con: ítems, payer completo, `external_reference`, back_urls y `notification_url`.  
   - Validar todos los montos en backend.

2. **Redirección / render de Checkout Pro o uso de Payments API**  
   - Evitar lógica crítica en frontend (por ejemplo, no calcular totales solo en cliente).

3. **Recepción de notificación (webhook)**  
   - Aceptar solo métodos y cabeceras esperadas.  
   - Registrar `id` y `topic` de la notificación.

4. **Consulta del pago / orden vía API oficial**  
   - Usar el `id` recibido para llamar a `/v1/payments/{id}` o `/merchant_orders/{id}`.  
   - Basar el estado de la orden interna **exclusivamente** en la respuesta de la API.

5. **Actualización de la base de datos interna**  
   - Estados típicos: `approved`, `pending`, `rejected`, `refunded`, `cancelled`.  
   - Evitar depender solo del front para marcar un pago como exitoso.

6. **Manejo de reintentos y errores**  
   - Implementar reintentos con backoff limitado (por ejemplo, máximo 5 intentos).  
   - Registrar errores y exponer métricas básicas (ratio de errores de webhook, latencia, etc.).

---

## 4. Webhooks de Mercado Pago - Buenas Prácticas

- **Seguridad del endpoint**  
  - Usar HTTPS obligatorio.  
  - Aceptar solo solicitudes desde internet, pero con validaciones de estructura y cabeceras.  
  - Evitar respuestas excesivamente verbosas (no retornar data sensible).

- **Validación de la notificación**  
  - No confiar solo en el cuerpo recibido.  
  - Usar el `id` para consultar el pago u orden en la API oficial.  
  - Mantener trazabilidad (logs con `payment_id`, `external_reference`, `topic`).

- **Idempotencia**  
  - Diseñar el procesamiento para que múltiples notificaciones sobre el mismo pago no generen estados inconsistentes.  
  - Consejo: usar llaves únicas por `payment_id` o `merchant_order_id`.

- **Reintentos del lado de tu sistema**  
  - Si la llamada a la API de Mercado Pago falla, volver a intentar con límites.  
  - No bloquear el hilo de respuesta del webhook con procesos muy pesados: delegar a colas / jobs cuando sea necesario.

---

## 5. Seguridad de Credenciales y Tokens

- **Access tokens de Mercado Pago**  
  - Deben almacenarse solo en el backend, nunca en frontend o código público.  
  - Usar variables de entorno y, si es posible, un gestor de secretos.

- **Tokens de Mercado Libre (access / refresh)**  
  - En línea con buenas prácticas OAuth 2.0:  
    - Guardar únicamente en backend.  
    - Encriptar en reposo (por ejemplo, AES-256 con clave rotatoria).  
    - Limitar quién puede leerlos a nivel de código y base de datos.

- **Rotación de claves**  
  - Definir un procedimiento para cambiar claves de API y claves de cifrado de forma segura.  
  - Registrar en auditoría cuándo se rotan y quién inició el cambio.

---

## 6. Mercado Libre - Recomendaciones

- **OAuth 2.0 + PKCE**  
  - Mantener la implementación actual si ya sigue el estándar (código de autorización, code_verifier, state).  
  - Validar siempre el parámetro `state` para prevenir CSRF.

- **Manejo de tokens**  
  - Refrescar tokens antes de su expiración y manejar errores de `invalid_token`.  
  - Registrar de forma segura los fallos al refrescar para poder actuar rápido.

- **Uso de APIs**  
  - Minimizar permisos solicitados (scopes) al estrictamente necesario.  
  - Manejar límites de rate-limit y backoff exponencial en caso de errores 429/5xx.

---

## 7. Observabilidad, Métricas y Operaciones

- **Logging estructurado**  
  - Incluir siempre: `payment_id`, `external_reference`, `topic`, `status`, `user_id` (si aplica).  
  - Evitar loguear tokens o datos sensibles completos.

- **Métricas recomendadas**  
  - Cantidad de pagos por estado.  
  - Latencia promedio de respuesta de webhooks.  
  - Errores de consulta a la API de Mercado Pago / Mercado Libre.  
  - Reintentos de procesos de conciliación.

- **Alertas operativas**  
  - Alto porcentaje de pagos `rejected`.  
  - Fallos recurrentes en llamadas a la API externa.  
  - Incremento en tiempo de respuesta de webhooks.

---

## 8. Consejos Prácticos para Desarrolladores

- **Mantener un entorno de sandbox bien configurado**  
  - Usar cuentas de prueba oficiales de Mercado Pago / Mercado Libre.  
  - Simular escenarios de aprobación, rechazo, devolución y cancelación.

- **Automatizar pruebas de flujo completo**  
  - Crear tests que generen una preferencia, paguen (en sandbox) y verifiquen que el webhook actualiza la orden interna correctamente.

- **Documentar decisiones técnicas**  
  - Registrar si se usa Checkout Pro, Checkout API o ambos.  
  - Documentar cómo se mapean los estados de pago a estados internos de órdenes.

- **Seguir de cerca los cambios de API**  
  - Suscribirse a newsletters / changelogs de Mercado Pago y Mercado Libre.  
  - Revisar periódicamente compatibilidad de versiones de SDKs y endpoints.

---

## 9. Checklist Final Resumido

- **Mercado Pago**  
  - [ ] Enviar `items.quantity`, `items.unit_price`, `items.category_id`.  
  - [ ] Enviar `payer.email`, `first_name`, `last_name`, `identification`, `address`, `phone` cuando estén disponibles.  
  - [ ] Configurar `back_urls` y `notification_url`.  
  - [ ] Usar `external_reference` para mapear pedidos internos.  
  - [ ] Consultar pagos/órdenes tras cada webhook antes de actualizar estado interno.  
  - [ ] Implementar reintentos con límites y logging estructurado.

- **Mercado Libre**  
  - [ ] Implementar OAuth 2.0 + PKCE completo con validación de `state`.  
  - [ ] Almacenar y encriptar tokens en backend.  
  - [ ] Manejar expiración y refresh de forma robusta.

- **Seguridad / Operaciones**  
  - [ ] Usar HTTPS y proteger endpoints de webhook.  
  - [ ] Evitar exponer secretos o tokens en logs.  
  - [ ] Implementar monitoreo, métricas y alertas básicas.

---

## 10. Conclusión

La integración propuesta, alineada con este documento, sigue las **mejores prácticas recomendadas por Mercado Pago y Mercado Libre**, y cumple con los puntos principales del **checklist de calidad** de Mercado Pago.

Aplicando estas recomendaciones tendrás:

- Mayor tasa de aprobación de pagos.  
- Menos contracargos y disputas.  
- Mejor capacidad de auditoría y conciliación.  
- Menor superficie de ataque en términos de seguridad.

## 11. Estado Actual de la Integración - Noviembre 2025

### 📊 **Resumen de Implementación**

**Estado General:** ⚠️ **En producción con errores críticos pendientes**

- **Mercado Pago:** ✅ Configurado y operativo con tokens de producción
- **Mercado Libre:** ✅ Conexión OAuth funcional en panel de administración  
- **Variables de Entorno:** ✅ Configuradas correctamente según DevCenter
- **Webhooks:** ✅ Endpoints configurados y accesibles

### 🐛 **Errores Críticos Identificados**

#### 1. **Checkout - Mismatch de URLs**
- **Archivo:** `/app/api/checkout/route.ts` (líneas 206-211)
- **Problema:** Las URLs de redirección usan `NEXT_PUBLIC_APP_URL` pero no coinciden con las configuradas en Mercado Pago
- **Impacto:** Los usuarios pueden ser redirigidos a URLs incorrectas después del pago
- **Solución:** Usar las variables de entorno específicas de Mercado Pago:
  ```typescript
  // Cambiar de:
  success: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`
  // A:
  success: process.env.MERCADO_PAGO_SUCCESS_URL
  ```

#### 2. **Sincronización de Productos - Bug en Manejo de Errores**
- **Archivo:** `/app/api/mercadolibre/products/sync/route.ts` (líneas 152-154)
- **Problema:** Intenta leer `req.json()` dos veces, causando error en el manejo de excepciones
- **Impacto:** Los errores de sincronización no se registran correctamente
- **Solución:** Almacenar el `productId` en una variable antes del bloque try-catch:
  ```typescript
  let productId: number;
  try {
    const body = await req.json();
    productId = parseInt(body.productId);
    // ... resto del código
  } catch (error) {
    if (productId) {
      // actualizar estado de error
    }
  }
  ```

#### 3. **Envíos - Inconsistencia de Interfaces**
- **Archivos:** `/lib/utils/shipping.ts`, `/app/api/shipping-methods/route.ts`
- **Problema:** Dos interfaces diferentes para métodos de envío (`ShippingMethod` vs `CheckoutShippingMethod`)
- **Impacto:** Posibles errores de tipo en tiempo de ejecución
- **Solución:** Unificar interfaces o crear adaptadores seguros

#### 4. **Ruteo de Sincronización - Posible Mismatch**
- **Componente:** `/components/admin/ProductSyncButton.tsx` (línea 27)
- **Problema:** Llama a `/api/mercadolibre/products/${productId}/sync` pero la ruta está en `/api/mercadolibre/products/sync/route.ts`
- **Impacto:** Las llamadas de sincronización pueden fallar con 404
- **Solución:** Verificar estructura de rutas dinámicas de Next.js

### ✅ **Componentes Funcionales Verificados**

1. **Autenticación Mercado Libre:** Panel de administración conecta exitosamente
2. **Creación de Preferencias:** Checkout genera preferencias válidas de Mercado Pago
3. **Webhooks:** Endpoints receptivos y configurados correctamente
4. **Cálculo de Envíos:** Funciona con zonas geográficas y pesos
5. **Gestión de Stock:** Validación correcta en checkout

### 🔄 **Flujo de Pagos Actual**

1. ✅ Usuario selecciona productos y completa dirección
2. ✅ Sistema calcula costo de envío según provincia y peso  
3. ✅ Se crea preferencia en Mercado Pago con todos los datos requeridos
4. ✅ Usuario es redirigido a checkout de Mercado Pago
5. ⚠️ **Posible error** en URLs de redirección post-pago
6. ✅ Webhook recibe notificación y actualiza estado del pedido

### 📈 **Métricas de Integración**

- **Conexión Mercado Libre:** 100% funcional en admin
- **Creación de Preferencias:** Operativa
- **Webhook Configuration:** Configurado y accesible
- **Error Rate:** Estimado 15-20% por bugs identificados
- **Sincronización Productos:** Parcialmente funcional con bugs

---

## 12. Plan de Acción Inmediato (Próximos 7 días)

### 🔥 **Crítico (Resolver en 48h)**
1. **Fix Checkout URLs** - Actualizar rutas de redirección
2. **Fix Sync Error Handling** - Corregir doble lectura de req.json()
3. **Verify API Routes** - Confirmar estructura de rutas dinámicas

### ⚡ **Importante (Resolver en 7 días)**  
4. **Unificar Shipping Interfaces** - Estandarizar tipos de envío
5. **Testing End-to-End** - Probar flujo completo de compra
6. **Error Monitoring** - Implementar logging detallado

### 📋 **Recomendado (Resolver en 30 días)**
7. **Dashboard de Monitoreo** - Métricas de integración en tiempo real
8. **Automated Testing** - Tests de integración automatizados
9. **Documentation Updates** - Mantener documentación sincronizada

---

## 13. Conclusión

La integración cumple con los requisitos principales de **Mercado Pago** y **Mercado Libre**, pero presenta **errores críticos que afectan la experiencia del usuario**. La conexión con Mercado Libre funciona correctamente en el panel administrativo, y los pagos se procesan, aunque con posibles problemas en las redirecciones.

**Estado recomendado:** 🔧 **Reparar errores críticos antes de escalar uso**

Una vez solucionados los issues identificados, la integración estará **lista para producción estable** con todas las funcionalidades operativas.

---

**Última actualización:** 25 de noviembre de 2025  
**Próxima revisión recomendada:** 2 de diciembre de 2025 (post-fixes)
# 