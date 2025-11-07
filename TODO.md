# TODO: Mejoras al Sistema de Stock

## Información Recopilada
- **Errores críticos**: Página muestra "¡Ups! Algo salió mal" por errores no manejados
- **Manejo inconsistente**: Stock en productos y variantes sin sincronización clara
- **Validaciones insuficientes**: Básicas pero no cubren casos edge
- **Concurrencia**: Sin manejo de race conditions en actualizaciones
- **Logging limitado**: Dificulta debugging
- **UI/UX issues**: Modo bulk problemático, optimizaciones pesimistas

## Plan de Mejoras

### 1. Corrección de Errores Críticos
- [ ] Mejorar manejo de errores en `page.tsx` con try-catch específicos
- [ ] Agregar validaciones más estrictas en inputs (números positivos, límites)
- [ ] Implementar rollback automático en fallos de actualización

### 2. Mejoras de Concurrencia y Consistencia
- [ ] Implementar locks optimistas en `stock.ts` usando version columns
- [ ] Agregar transacciones más robustas con retry logic
- [ ] Sincronizar stock entre productos y variantes en `productVariants.ts`

### 3. Mejoras de UI/UX
- [ ] Corregir modo bulk en `page.tsx` (deshabilitar inputs individuales)
- [ ] Mejorar feedback visual (loading states, success/error messages)
- [ ] Optimizar carga de datos con pagination y lazy loading

### 4. Logging Mejorado
- [ ] Expandir logging en `stock.ts` con metadata detallada (userId, timestamps, operation type)
- [ ] Agregar logs de errores con contexto en `page.tsx`
- [ ] Implementar métricas de stock bajo y alertas en `schema.ts` (nueva tabla opcional)

### 5. Validaciones y Seguridad
- [ ] Agregar validaciones estrictas en `stock.ts` (stock no negativo, límites superiores)
- [ ] Sanitización de inputs en `route.ts`
- [ ] Rate limiting específico para operaciones de stock

## Archivos a Modificar
- `app/admin/products/[id]/stock/page.tsx`
- `lib/actions/stock.ts`
- `lib/schema.ts` (posible nueva tabla para métricas)
- `lib/actions/productVariants.ts`
- `app/api/admin/products/[id]/variants/route.ts`

## Próximos Pasos
1. [ ] Identificar errores específicos en página
2. [ ] Implementar correcciones críticas
3. [ ] Mejorar concurrencia
4. [ ] Optimizar UI/UX
5. [ ] Agregar logging avanzado
6. [ ] Testing exhaustivo
