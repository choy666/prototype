# Funcionalidad de Limpieza del Carrito después del Checkout

## Descripción General

Esta funcionalidad implementa el vaciado automático del carrito del localStorage después de que un usuario complete exitosamente un checkout y regrese al sitio desde Mercado Pago.

## Problema Resuelto

Anteriormente, cuando un usuario completaba una compra exitosa y regresaba al sitio, el carrito mantenía los productos que ya había comprado, lo que podía causar confusión y permitir compras duplicadas accidentales.

## Solución Implementada

### 1. Hook Personalizado: `useCartClearOnSuccess`

Se creó un hook personalizado que:

- **Detecta automáticamente** pagos exitosos a través de parámetros URL
- **Limpia el carrito** cuando se detecta un pago aprobado
- **Muestra notificaciones** toast al usuario
- **Limpia parámetros URL** para evitar procesamientos duplicados
- **Proporciona flexibilidad** de configuración

**Ubicación:** `hooks/useCartClearOnSuccess.ts`

#### Parámetros de Configuración

```typescript
interface UseCartClearOnSuccessOptions {
  autoClean?: boolean;          // Limpiar automáticamente (default: true)
  successStatuses?: string[];   // Estados considerados exitosos
  showToast?: boolean;          // Mostrar notificaciones (default: true)
  onSuccess?: (paymentInfo: PaymentInfo) => void;
  onCartCleared?: () => void;
}
```

#### Estados de Pago Considerados Exitosos

- `approved` - Pago aprobado por Mercado Pago
- `success` - Pago exitoso (usado internamente)

### 2. Integración en Páginas Clave

#### A. Página de Éxito del Pago (`payment-success/page.tsx`)

- **Limpieza inmediata** del carrito cuando el pago es aprobado
- **Redirección inteligente** al dashboard con información del pago
- **Tiempo de espera** para mostrar el estado antes de redirigir

```typescript
const { paymentInfo, isPaymentSuccessful, cleanUrlParams } = useCartClearOnSuccess({
  autoClean: true,
  onSuccess: (info) => console.log('✅ Pago exitoso procesado:', info),
  onCartCleared: () => console.log('🛒 Carrito limpiado en payment-success'),
});
```

#### B. Dashboard (`dashboard/page.tsx`)

- **Detección de pagos exitosos** que llegan con parámetros
- **Limpieza automática** del carrito si detecta pago exitoso
- **Limpieza de URL** para evitar procesamientos múltiples

```typescript
const { paymentInfo, isPaymentSuccessful, cleanUrlParams } = useCartClearOnSuccess({
  autoClean: true,
  onSuccess: (info) => console.log('✅ Pago detectado en dashboard:', info),
  onCartCleared: () => console.log('🛒 Carrito limpiado en dashboard'),
});
```

#### C. Página del Carrito (`cart/page.tsx`)

- **Estado especial** para usuarios que regresan después de pago exitoso
- **Mensaje de confirmación** con detalles del pago
- **Enlaces rápidos** a productos y dashboard

### 3. Parámetros URL Monitoreados

El hook detecta los siguientes parámetros de Mercado Pago:

| Parámetro | Descripción |
|-----------|-------------|
| `collection_status` | Estado de la colección del pago |
| `status` | Estado general del pago |
| `payment_id` | ID único del pago |
| `merchant_order_id` | ID de la orden del comerciante |
| `order_id` | ID alternativo de la orden |
| `payment_type` | Tipo de pago utilizado |

### 4. Flujo de Usuario

```
1. Usuario agrega productos al carrito → Guardado en localStorage
                ↓
2. Usuario inicia checkout → Redirección a Mercado Pago
                ↓
3. Usuario completa pago → Mercado Pago redirige de vuelta
                ↓
4. Hook detecta pago exitoso → Limpia carrito automáticamente
                ↓
5. Usuario ve confirmación → Carrito vacío, estado limpio
```

## Casos de Uso Cubiertos

### ✅ Pagos Exitosos
- `collection_status=approved`
- `status=approved` 
- `status=success`

### ❌ Pagos No Exitosos (Carrito NO se limpia)
- `collection_status=pending`
- `collection_status=rejected`
- `status=pending`
- `status=failure`
- Sin parámetros de pago

## Características Técnicas

### Persistencia Inteligente
- **Zustand + localStorage**: Mantiene sincronización automática
- **Hidratación segura**: Maneja correctamente el SSR de Next.js
- **Error handling**: Recuperación graceful ante fallos de storage

### Detección Robusta
- **Múltiples parámetros**: Detecta diferentes formatos de Mercado Pago
- **Validación estricta**: Solo limpia en casos verdaderamente exitosos
- **Prevención duplicados**: Limpia parámetros URL después del procesamiento

### UX Mejorada
- **Notificaciones toast**: Confirmación visual al usuario
- **Estados especiales**: UI diferente para usuarios post-pago
- **Información del pago**: Muestra detalles relevantes del pedido

## Testing

Se incluye un script de pruebas completo: `scripts/test-cart-clear.js`

### Tipos de Tests
1. **Tests de lógica**: Verifican detección correcta de estados
2. **Tests de persistencia**: Verifican funcionamiento del localStorage
3. **Tests de URL**: Verifican limpieza de parámetros

### Ejecutar Tests
```bash
node scripts/test-cart-clear.js
```

## Configuración de Desarrollo

### Requisitos
- Next.js 13+ con App Router
- Zustand para manejo de estado
- React Hook Form para formularios
- Tailwind CSS para estilos

### Variables de Entorno
```env
APP_URL=https://tu-dominio.com  # Para URLs de retorno de Mercado Pago
```

## Logging y Debugging

El sistema incluye logging detallado:

```javascript
// Logs de éxito
console.log('✅ Pago exitoso detectado:', paymentInfo);
console.log('🛒 Carrito vaciado automáticamente después del checkout exitoso');

// Logs de limpieza URL
console.log('🧹 Parámetros de URL de pago limpiados');
```

## Posibles Mejoras Futuras

1. **Analytics**: Tracking de conversiones exitosas
2. **Historial**: Mantener registro de compras anteriores
3. **Recuperación**: Opción de restaurar carrito en caso de error
4. **Notificaciones**: Sistema de notificaciones más sofisticado
5. **A/B Testing**: Diferentes estrategias de limpieza

## Troubleshooting

### Problema: El carrito no se vacía después del pago
**Solución**: Verificar que los parámetros URL lleguen correctamente desde Mercado Pago

### Problema: Se vacía el carrito en pagos pendientes
**Solución**: Revisar la configuración de `successStatuses` en el hook

### Problema: Notificaciones duplicadas
**Solución**: Asegurarse de que `showToast: false` esté configurado en páginas secundarias

## Archivos Modificados/Creados

### Nuevos Archivos
- `hooks/useCartClearOnSuccess.ts` - Hook principal
- `scripts/test-cart-clear.js` - Suite de tests
- `docs/CART_CLEAR_FEATURE.md` - Esta documentación

### Archivos Modificados
- `app/(protected)/payment-success/page.tsx` - Integración del hook
- `app/(protected)/dashboard/page.tsx` - Detección en dashboard
- `app/cart/page.tsx` - Estado especial post-pago

## Conclusión

Esta implementación proporciona una experiencia de usuario fluida y profesional, asegurando que el carrito se mantenga limpio después de compras exitosas mientras preserva la funcionalidad en casos de pagos fallidos o pendientes.

La solución es robusta, bien probada y fácil de mantener, siguiendo las mejores prácticas de React y Next.js.