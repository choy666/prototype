# TODO: Gestión de Stock para Productos y Variantes

## Objetivo
Permitir editar el stock del producto y sus variantes en una página dedicada (`app/admin/products/id/stock`), con historial de cambios. Además, hacer que el campo de stock sea de solo lectura en `components/admin/ProductVariants.tsx` cuando se usa en la página de edición.

## Pasos a Realizar

### 1. Crear Página de Gestión de Stock
- [ ] Crear `app/admin/products/[id]/stock/page.tsx`
- [ ] Implementar interfaz para editar stock del producto principal
- [ ] Implementar interfaz para editar stock de variantes existentes
- [ ] Agregar historial de cambios de stock (usando `getStockLogs`)
- [ ] Integrar con acciones de `lib/actions/stock.ts` para logging

### 2. Modificar Componente ProductVariants
- [ ] Agregar prop `stockReadOnly` a `components/admin/ProductVariants.tsx`
- [ ] Hacer el campo de stock de solo lectura cuando `stockReadOnly={true}`
- [ ] Actualizar uso en `app/admin/products/[id]/edit/page.tsx` para pasar `stockReadOnly={true}`

### 3. Verificación y Testing
- [ ] Probar edición de stock en la nueva página
- [ ] Verificar que el historial se registre correctamente
- [ ] Confirmar que el campo de stock es de solo lectura en edición
- [ ] Verificar navegación y permisos

## Archivos Involucrados
- `app/admin/products/[id]/stock/page.tsx` (nuevo)
- `components/admin/ProductVariants.tsx` (modificar)
- `app/admin/products/[id]/edit/page.tsx` (modificar uso)
- `lib/actions/stock.ts` (usar existente)

## Dependencias
- Requiere `lib/actions/stock.ts` para ajustar stock con logging
- Usa `getStockLogs` para mostrar historial
