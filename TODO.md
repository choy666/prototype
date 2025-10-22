# Investigación y Solución: Órdenes no se generan en producción después del checkout

## Información Recopilada
- **Flujo del checkout**: Crea preferencia en MercadoPago con metadata, usuario paga, webhook procesa pago aprobado y crea orden.
- **Archivos clave**:
  - `app/api/checkout/route.ts`: Crea preferencia con metadata.
  - `app/api/webhooks/mercado-pago/route.ts`: Procesa webhook y crea orden si pago aprobado.
  - Scripts de validación: `scripts/validate-webhook-config.ts`, `scripts/test-webhook.ts`.
- **Posibles causas**: Webhook no configurado, metadata inválida, errores en BD, problemas de red.

## Plan de Investigación y Solución

### 1. Verificar configuración del webhook en MercadoPago
- Ejecutar script de validación de configuración.
- Verificar que la URL del webhook esté configurada correctamente en el dashboard de MP.
- Confirmar que el evento `payment.updated` esté habilitado.

### 2. Revisar logs en producción
- Buscar logs de error en el webhook endpoint.
- Verificar si se están recibiendo webhooks.
- Identificar errores específicos en el procesamiento.

### 3. Probar estructura de datos del webhook
- Ejecutar script de prueba de estructura de datos.
- Verificar que la metadata se esté enviando correctamente desde checkout.

### 4. Verificar conectividad y estado de la base de datos
- Ejecutar script de verificación de salud de BD.
- Confirmar que las operaciones de inserción funcionen.

### 5. Simular webhook manualmente
- Crear un script para simular envío de webhook con datos de prueba.
- Verificar que el procesamiento funcione correctamente.

### 6. Implementar mejoras de robustez
- Agregar más logging detallado.
- Mejorar manejo de errores.
- Agregar validaciones adicionales.

### 7. Probar en staging/entorno controlado
- Desplegar cambios en un entorno de prueba.
- Realizar pruebas completas del flujo de checkout.

### 8. Monitoreo y alertas
- Configurar alertas para fallos en creación de órdenes.
- Agregar métricas de éxito/fallo de webhooks.
