# TODO: Solución para guardar imágenes en variantes de producto

## Problema
Al crear una nueva variante del producto en la página `./app/admin/products/[id]/edit/page.tsx`, luego de "Actualizar Variante", las imágenes agregadas a la variante no se almacenan en la base de datos.

## Análisis del problema
- **Frontend**: El componente `ProductVariants.tsx` envía un array `images: string[]` en el form data
- **API Route**: El esquema de validación solo acepta `image: string` (única imagen)
- **Base de datos**: La tabla `productVariants` solo tiene campo `image: text` (única imagen)
- **Actions**: Las funciones no manejan arrays de imágenes

## Plan de implementación

### Información recopilada 
- Archivo principal: `app/admin/products/[id]/edit/page.tsx`
- Componente de variantes: `components/admin/ProductVariants.tsx`
- API route: `app/api/admin/products/[id]/variants/route.ts`
- Actions: `lib/actions/productVariants.ts`
- Schema: `lib/schema.ts` (tabla `productVariants`)

### Plan detallado
1. **Actualizar schema de base de datos - [ ]** 
   - Agregar campo `images: jsonb("images")` a tabla `productVariants`
   - Mantener `image` para compatibilidad hacia atrás

2. **Actualizar validación de API - [ ]**
   - Modificar `createVariantSchema` en `route.ts` para aceptar `images: z.array(z.string()).optional()`
   - Actualizar lógica de POST/PUT para manejar `images`

3. **Actualizar acciones de servidor - [ ]**
   - Modificar `createProductVariant` y `updateProductVariant` para manejar campo `images`
   - Actualizar `getProductVariants` para retornar `images`

4. **Actualizar tipos TypeScript - [ ]**
   - Actualizar interfaces `ProductVariant` y `NewProductVariant` en `schema.ts`

5. **Crear migración de base de datos - [ ]**
   - Generar migración con Drizzle para agregar columna `images`

### Archivos a modificar
- `lib/schema.ts`: Agregar campo `images` a `productVariants`
- `app/api/admin/products/[id]/variants/route.ts`: Actualizar validación y lógica
- `lib/actions/productVariants.ts`: Actualizar funciones CRUD
- Crear migración: `drizzle/XXXX_add_images_to_product_variants.sql`

### Pasos de seguimiento
- Ejecutar migración de base de datos
- Probar creación/edición de variantes con múltiples imágenes
- Verificar que las imágenes se guarden y recuperen correctamente
- Actualizar documentación si es necesario

### Riesgos
- Cambio en schema requiere migración de datos existentes
- Posible ruptura de compatibilidad si hay código que asuma solo `image`
- Necesidad de actualizar queries que usen variantes
