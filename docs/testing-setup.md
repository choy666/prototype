# Configuración de Testing para Checkout/Pagos

## Problemas Actuales

Los errores de TypeScript son esperados - faltan dependencias y configuración.

## Pasos para Configurar

### 1. Instalar Dependencias Faltantes

```bash
npm install --save-dev @playwright/test
npm install --save-dev node-mocks-http
npm install --save-dev @types/node-mocks-http
```

### 2. Instalar Browsers de Playwright

```bash
npx playwright install
```

### 3. Corregir Imports en Tests

Los tests usan Jest globals que necesitan configuración proper. El setup ya existe en `jest.setup.js`.

### 4. Ejecutar Tests

```bash
# Tests unitarios
npm run test:unit

# Tests de integración
npm run test:integration

# Tests E2E (requiere servidor corriendo)
npm run test:e2e

# Todos los tests
npm run test
# test cobertura
npm run test:coverage
```

## Estructura de Tests Creada

### Unit Tests (`tests/unit/`)

- `CheckoutSummary.test.tsx` - Componente de resumen de pedido
- `ShippingForm.test.tsx` - Formulario de envío y validación de documentos
- `AddressSelector.test.tsx` - Selector de direcciones guardadas

### Integration Tests (`tests/integration/`)

- `checkout.test.ts` - Servicio completo de checkout
- `shipments.test.ts` - API de cálculo de envíos ME2
- `mercadopago-webhook.test.ts` - Webhook de confirmación de pagos

### E2E Tests (`tests/e2e/`)

- `checkout.spec.ts` - Flujo completo del usuario en el navegador

### Mocks (`tests/setup/mocks/`)

- `mercadopago.ts` - Mocks completos del SDK de MercadoPago

## Casos de Prueba Cubiertos

1. **Flujo feliz**: Checkout completo con dirección existente
2. **Validaciones**: DNI/CUIT, stock, compatibilidad ME2
3. **Errores**: Productos sin stock, ME2 no disponible, pagos rechazados
4. **Webhooks**: Procesamiento de notificaciones de MercadoPago
5. **Fallback**: Envío local cuando ME2 falla
6. **Permisos**: Bloqueo de checkout para usuarios admin

## Notas Importantes

- Los tests de integración usan `CheckoutService` en lugar de llamar directamente a las rutas API (mejor práctica para Next.js App Router)
- Los mocks están configurados para no interferir entre sí
- Los tests E2E interceptan la redirección a MercadoPago (no completan pagos reales)
- Se incluye validación de HMAC para webhooks de MercadoPago
