# Mejoras al Sistema de Atributos y Variantes

## Información Recopilada
- Sistema actual: Atributos predefinidos (Talla, Color, etc.) con valores fijos, variantes generadas automáticamente con todas las combinaciones posibles
- SKU presente en esquemas, formularios y componentes
- UI básica para gestión de atributos y variantes
- Variantes creadas con selección manual de atributos existentes

## Plan de Mejoras
1. **Eliminar SKU completamente**: Remover de esquemas, tipos, formularios y componentes
2. **Hacer atributos dinámicos**: Permitir crear atributos inline en el formulario de producto sin necesidad de predefinirlos
3. **Mejorar UI de variantes**: Interfaz más intuitiva para agregar/editar variantes con builder visual
4. **Optimizar flujo de creación**: Simplificar proceso de agregar atributos y variantes
5. **Generación inteligente de variantes**: Permitir variantes personalizadas sin forzar todas las combinaciones

## Pasos de Implementación

### 1. Eliminar SKU del Sistema
- [x] Remover campo `sku` de tabla `productVariants` en `lib/schema.ts`
- [x] Actualizar tipos TypeScript `ProductVariant` y `NewProductVariant`
- [x] Remover SKU de `lib/actions/productVariants.ts`
- [x] Actualizar formularios: `app/admin/products/new/page.tsx` y `components/admin/ProductVariants.tsx`
- [x] Verificar y actualizar APIs relacionadas

### 2. Hacer Atributos Dinámicos
- [x] Modificar `app/admin/products/new/page.tsx` para permitir agregar atributos inline
- [x] Crear componente `AttributeBuilder` para gestión dinámica de atributos
- [x] Actualizar lógica de generación de variantes para trabajar con atributos dinámicos
- [x] Mantener compatibilidad con atributos predefinidos existentes

### 3. Eliminar Atributos Predefinidos
- [x] Remover sección de "Atributos Predefinidos" de `app/admin/products/new/page.tsx`
- [x] Eliminar estado `selectedAttributes` y lógica relacionada
- [x] Simplificar lógica de generación de variantes para usar solo `dynamicAttributes`
- [x] Verificar si `components/admin/ProductAttributes.tsx` y `app/admin/products/attributes/page.tsx` se pueden eliminar
- [x] Actualizar APIs relacionadas si es necesario

### 4. Mejorar UI de Gestión de Variantes
- [x] Rediseñar componente `ProductVariants.tsx` con mejor UX
- [x] Agregar vista de tabla/grid para variantes
- [x] Implementar drag & drop para reordenar variantes
- [x] Agregar validaciones visuales y feedback

### 5. Optimizar APIs y Acciones
- [x] Actualizar `lib/actions/productVariants.ts` para nuevos flujos
- [x] Modificar APIs en `app/api/admin/products/[id]/variants/route.ts`
- [x] Asegurar compatibilidad con datos existentes

### 6. Testing y Validación
- [ ] Probar creación de productos con atributos dinámicos
- [ ] Verificar eliminación de SKU no rompe funcionalidad
- [ ] Testear UI mejorada en diferentes escenarios
- [ ] Validar migración de datos existentes

## Archivos a Modificar
- `lib/schema.ts` - Eliminar SKU, actualizar tipos
- `lib/actions/productVariants.ts` - Remover SKU, actualizar lógica
- `app/admin/products/new/page.tsx` - Atributos dinámicos, quitar SKU
- `components/admin/ProductVariants.tsx` - Mejorar UI, quitar SKU
- `app/api/admin/products/[id]/variants/route.ts` - Actualizar API
- `components/admin/ProductAttributes.tsx` - Posible simplificación

## Seguimiento de Progreso
- [x] Análisis del sistema actual completado
- [x] Plan de mejoras aprobado
- [x] TODO.md creado
- [ ] Implementación iniciada
