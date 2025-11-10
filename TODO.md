# Tarea: Cambiar estado de variante basado en stock

## Descripción
Implementar lógica automática para desactivar variantes cuando su stock llegue a 0 y activarlas cuando tengan stock positivo (> 0).

## Pasos a completar

### 1. Modificar función adjustVariantStock en lib/actions/stock.ts
- [x] Agregar lógica para setear isActive = false cuando stock = 0
- [x] Agregar lógica para setear isActive = true cuando stock > 0

### 2. Modificar rutas API de variantes
- [x] Actualizar app/api/admin/products/[id]/variants/route.ts (PUT)
- [x] Actualizar app/api/admin/products/[id]/variants/route-new.ts (PUT)
- [x] Agregar lógica automática de activación/desactivación en actualizaciones

### 3. Verificar componentes
- [x] Revisar si ProductVariantsNew.tsx necesita cambios (probablemente no, ya maneja activación manual)

### 4. Testing
- [ ] Probar que las variantes se desactiven automáticamente cuando stock = 0
- [ ] Probar que las variantes se activen automáticamente cuando stock > 0
- [ ] Verificar que la lógica funcione en ajustes de stock desde admin
