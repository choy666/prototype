# TODO: Mejoras en app/products/[id] para Imágenes y Variantes

## Información Recopilada
- **page.tsx**: Componente servidor que obtiene producto y variantes usando `getProductById` y `getProductVariants`.
- **ProductClient.tsx**: Componente cliente que maneja la UI del producto, incluyendo galería de imágenes, selección de variantes y carrito.
- **Esquema de BD**: 
  - `products.image`: Imagen principal (string).
  - `products.images`: Array de imágenes secundarias (jsonb).
  - `productVariants.image`: Imagen específica de variante (string).
- **Tipos**: `Product.image` puede ser string o string[], pero no refleja `images` del esquema.
- **Problemas Actuales**:
  - Solo usa `product.image` para la galería, ignorando `product.images`.
  - Las variantes tienen imágenes propias, pero no se integran bien en la galería.
  - Las miniaturas están limitadas a 3 imágenes, sin incluir imágenes de variantes.
  - No hay manejo de imágenes secundarias del producto.

## Plan de Mejoras
### 1. Actualizar Tipos de Datos - [X]
- Modificar `types/index.ts` para incluir `images` en la interfaz `Product`.
- Asegurar compatibilidad con el esquema de BD.

### 2. Mejorar Lógica de Imágenes en ProductClient.tsx - [X]
- Combinar `product.image` (principal) y `product.images` (secundarias) en una galería completa.
- Incluir imágenes de variantes activas en la galería cuando se selecciona una variante.
- Actualizar `productImages` para incluir todas las imágenes disponibles.
- Modificar navegación de imágenes para manejar más de 3 imágenes.
- Actualizar miniaturas para mostrar todas las imágenes relevantes.

### 3. Manejo de Variantes - [X]
- Priorizar imagen de variante seleccionada sobre imágenes del producto.
- Mostrar imágenes de variante en la galería cuando corresponde.
- Actualizar lógica de selección para cambiar imagen automáticamente al seleccionar variante.

### 4. Optimizaciones de UI/UX - [ ]
- Mejorar indicadores visuales para imágenes principales vs secundarias vs de variantes.
- Añadir tooltips o etiquetas para identificar tipo de imagen.
- Implementar lazy loading para imágenes adicionales.
- Mejorar responsividad de la galería.

### 5. Actualizar Consultas de Datos - [ ]
- Verificar que `getProductById` incluya `images` del producto.
- Asegurar que variantes incluyan `image` cuando esté disponible.

## Archivos a Editar
- `types/index.ts`: Actualizar interfaz Product.
- `app/products/[id]/ProductClient.tsx`: Lógica principal de imágenes y variantes.
- `lib/actions/products.ts`: Posiblemente actualizar consulta para incluir `images`.

## Pasos de Seguimiento
- Probar con productos que tengan múltiples imágenes y variantes con imágenes.
- Verificar compatibilidad con migraciones de imágenes existentes.
- Ejecutar pruebas de UI para diferentes combinaciones de imágenes.
- Optimizar carga de imágenes para mejor performance.

## Notas Adicionales
- Mantener compatibilidad hacia atrás con productos que solo tienen `image` principal.
- Considerar impacto en componentes relacionados como ProductCard.
- Posiblemente integrar con `scripts/migrate-images.ts` para asegurar consistencia de datos.
