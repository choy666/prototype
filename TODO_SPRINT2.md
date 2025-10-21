# Sprint 2: Gestión de Direcciones - Estado de Implementación

## ✅ COMPLETADO

### 1. Base de Datos
- [x] Agregar tabla `addresses` a `lib/schema.ts`
  - Campos: id, userId, nombre, direccion, ciudad, provincia, codigoPostal, telefono, isDefault, createdAt, updatedAt
  - Relación con users
  - Índice único para userId + isDefault
- [x] Generar y aplicar migración de BD

### 2. API Endpoints
- [x] Crear `app/api/addresses/route.ts`
  - GET: Listar direcciones del usuario autenticado
  - POST: Crear nueva dirección
- [x] Crear `app/api/addresses/[id]/route.ts`
  - GET: Obtener dirección específica
  - PUT: Actualizar dirección
  - DELETE: Eliminar dirección
- [x] Crear `app/api/addresses/[id]/default/route.ts`
  - PUT: Marcar dirección como predeterminada

### 3. Validaciones y Tipos
- [x] Actualizar `lib/validations/checkout.ts`
  - Agregar schema para Address (addressSchema)
- [x] Actualizar `types/index.ts`
  - Agregar tipos para Address

## ✅ COMPLETADO

### 4. Componentes de UI
- [x] Crear `components/checkout/AddressForm.tsx`
  - Reutilizar lógica de ShippingForm
  - Para crear/editar direcciones guardadas
- [x] Crear `components/checkout/AddressSelector.tsx`
  - Mostrar lista de direcciones guardadas
  - Opción "Usar nueva dirección"
  - Botones editar/eliminar
  - Seleccionar dirección predeterminada

### 5. Integración en Checkout
- [x] Modificar `app/checkout/page.tsx`
  - Agregar AddressSelector antes de ShippingForm
  - Si selecciona dirección guardada, pre-llenar ShippingForm
  - Si elige nueva, mostrar ShippingForm vacío
  - Opción para guardar nueva dirección durante checkout

### 6. Testing y Validación
- [ ] Probar creación de direcciones
- [ ] Probar selección en checkout
- [ ] Verificar persistencia de direcciones
- [ ] Validar permisos (solo usuario propietario)

## 📋 DEPENDENCIAS
- Requiere autenticación de usuario
- Depende de tabla users existente
- Integración con checkout existente

## 🔄 FLUJO ESPERADO
```
Usuario en checkout
    ↓
¿Tiene direcciones guardadas?
    ↓ Sí → AddressSelector (elegir existente o nueva)
    ↓ No → ShippingForm (crear nueva, opción guardar)
    ↓
Procesar pago con dirección seleccionada
