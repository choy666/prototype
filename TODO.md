# TODO: Corrección del Manejo de Imágenes en Variantes de Producto

## Problema Identificado
- Error en la consulta de variantes de producto: `column "image" does not exist`
- El hint de PostgreSQL sugiere usar `product_variants.images` en lugar de `product_variants.image`
- Inconsistencia entre el schema de Drizzle (que define ambas columnas `image` y `images`) y la base de datos real

## Análisis del Código Actual
- **Schema (`lib/schema.ts`)**: Define `image: text("image")` y `images: jsonb("images")`
- **Actions (`lib/actions/productVariants.ts`)**: Selecciona y maneja ambas columnas
- **API Route (`app/api/admin/products/[id]/variants/route.ts`)**: Acepta `image` y `images` en el schema de validación
- **Migraciones**: La columna `image` se creó en `0010_minor_red_skull.sql`, y `images` se agregó en `0014_huge_vindicator.sql`

## Solución Propuesta
Dado que la base de datos solo reconoce `images` y no `image`, se debe:
1. Eliminar la columna `image` del schema y código
2. Usar únicamente `images` como array de strings para todas las imágenes de variante
3. Actualizar todas las referencias en el código
4. Crear migración para eliminar la columna `image` si existe
5. Actualizar validaciones y tipos TypeScript

## Pasos de Implementación

### 1. Verificar Estado de la Base de Datos
- [x] Ejecutar consulta directa para verificar columnas existentes en `product_variants`
- [x] Confirmar si `image` existe o solo `images`
- [x] Revisar migraciones aplicadas vs schema actual

### 2. Actualizar Schema de Drizzle
- [x] Remover `image: text("image")` de la tabla `productVariants` en `lib/schema.ts`
- [x] Mantener solo `images: jsonb("images")`
- [x] Actualizar tipos TypeScript (`ProductVariant`, `NewProductVariant`)

### 3. Crear Migración de Base de Datos
- [x] Generar nueva migración con `npx drizzle-kit generate`
- [ ] Aplicar migración con `npx drizzle-kit push` para eliminar columna `image` si existe

### 4. Actualizar Actions (`lib/actions/productVariants.ts`)
- [x] Remover selección de `productVariants.image` en `getProductVariants`
- [x] Actualizar `createProductVariant` para no insertar `image`
- [x] Actualizar `updateProductVariant` para no manejar `image`
- [x] Ajustar lógica de normalización de imágenes si es necesario

### 5. Actualizar API Route (`app/api/admin/products/[id]/variants/route.ts`)
- [x] Remover `image: z.string().optional()` del schema de validación `createVariantSchema`
- [x] Mantener solo `images: z.array(z.string()).optional()`
- [x] Actualizar mapeo de datos para no incluir `image`
- [x] Agregar método PUT para actualizaciones

### 6. Actualizar Validaciones y Tipos
- [x] Revisar `lib/validations/checkout.ts` y otros archivos que referencien `image` en variantes
- [x] Actualizar tipos en `types/index.ts` si es necesario
- [x] Verificar componentes que usen variantes de producto

### 7. Actualizar Componentes Frontend
- [x] Revisar componentes que manejen imágenes de variantes (ej: `components/admin/ProductVariants.tsx`)
- [x] Asegurar que solo usen el array `images`
- [x] Actualizar formularios de creación/edición de variantes

### 8. Probar Funcionalidad
- [ ] Crear variante de producto con imágenes
- [ ] Editar variante existente
- [ ] Obtener variantes de producto
- [ ] Verificar que no haya errores de columna inexistente
- [ ] Probar flujo completo en interfaz de administración

### 9. Limpieza y Documentación
- [ ] Remover código comentado relacionado con `image`
- [ ] Actualizar comentarios y documentación
- [ ] Verificar que todas las referencias a `image` en variantes hayan sido eliminadas

## Archivos a Modificar
- `lib/schema.ts`
- `lib/actions/productVariants.ts`
- `app/api/admin/products/[id]/variants/route.ts`
- `types/index.ts` (si necesario)
- `lib/validations/checkout.ts` (si necesario)
- Componentes relacionados con variantes
- Posiblemente `drizzle/` (nueva migración)

## Notas Importantes
- Mantener compatibilidad hacia atrás si hay datos existentes en `image`
- Considerar migrar datos de `image` a `images` si es necesario
- Asegurar que `images` sea siempre un array, incluso si viene como string (usar transformación similar a productos)
- Verificar impacto en carrito, checkout y órdenes que usen variantes

## Riesgos
- Pérdida de datos si `image` contenía información no migrada a `images`
- Errores en componentes que esperan `image` como propiedad
- Inconsistencias si no se actualizan todas las referencias

## Criterios de Éxito
- [ ] No hay errores de "column 'image' does not exist"
- [ ] Variantes se crean y editan correctamente con imágenes
- [ ] API responde sin errores
- [ ] Interfaz de administración funciona correctamente
- [ ] Base de datos sincronizada con schema
