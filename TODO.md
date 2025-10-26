# Plan de Implementación: Restringir Acceso de Admins a Compras y Pedidos

## Información Recopilada
- Roles definidos: "user" y "admin" en schema.ts
- Funciones de auth disponibles en lib/auth/session.ts
- Páginas y APIs sin verificación de rol para acciones de usuario

## Pasos de Implementación

### 1. Utilidades de Autenticación
- [ ] Agregar función helper `isAdmin()` en `lib/auth/session.ts`

### 2. Middleware
- [ ] Actualizar `middleware.ts` para verificar rol en rutas de checkout y órdenes

### 3. APIs Backend
- [ ] Modificar `app/api/checkout/route.ts` para rechazar admins
- [ ] Modificar `app/api/orders/route.ts` para rechazar admins

### 4. Páginas Frontend
- [ ] Actualizar `app/checkout/page.tsx` para verificar rol y redirigir admins
- [ ] Actualizar `app/(protected)/orders/page.tsx` para verificar rol y redirigir admins

### 5. Componentes UI
- [ ] Revisar `components/ui/Navbar.tsx` para ocultar enlaces de compra a admins
- [ ] Revisar componentes de carrito para deshabilitar funcionalidades

### 6. Pruebas
- [ ] Probar restricciones como admin
- [ ] Verificar que usuarios normales sigan funcionando
- [ ] Documentar cambios si necesario
