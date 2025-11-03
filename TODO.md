# Plan de Implementación: Actualización del Carrito para Variantes de Productos

## Información Recopilada
- **Estado Actual**: El carrito guarda `variantId` en los items, pero la lógica de agregar items no distingue entre variantes diferentes del mismo producto. Actualmente, si se agregan dos variantes distintas del mismo producto, se suman las cantidades en un solo item en lugar de tratarlas como productos separados.
- **Archivos Analizados**:
  - `types/index.ts`: Define `ProductVariant` con `image` y atributos.
  - `app/products/[id]/ProductClient.tsx`: Maneja selección de variantes y pasa `variantId` e `image` correcta al botón de agregar.
  - `components/cart/AddToCartButton.tsx`: Recibe y pasa `variantId` al store.
  - `lib/stores/useCartStore.ts`: Almacena `variantId`, pero `addItem` busca items existentes solo por `id` (no por variante).
  - `app/cart/page.tsx` y `components/cart/MiniCart.tsx`: Muestran items pero no información específica de variante (atributos como color, talla).
- **Problemas Identificados**:
  - Variantes no se tratan como items separados en el carrito.
  - No se muestra información de variante en la UI del carrito (e.g., "Color: Rojo").
  - La imagen se guarda correctamente, pero falta mostrar detalles de variante.

## Plan de Implementación

### 1. Actualizar Store del Carrito (`lib/stores/useCartStore.ts`)
- Cambiar lógica de `addItem` para distinguir items por combinación de `id` y `variantId`.
- Usar una key compuesta como `${id}-${variantId || 'default'}` para identificar items únicos.
- Asegurar que variantes diferentes del mismo producto sean items separados.

### 2. Actualizar Tipos (`types/index.ts`)
- Agregar campo `variantAttributes` a `CartItem` para almacenar los atributos de la variante seleccionada (e.g., {color: 'Rojo', talla: 'M'}).

### 3. Actualizar Componente de Agregar al Carrito (`components/cart/AddToCartButton.tsx`)
- Pasar `variantAttributes` al store junto con `variantId`.

### 4. Actualizar Página del Carrito (`app/cart/page.tsx`)
- Mostrar información de variante debajo del nombre del producto (e.g., "Color: Rojo, Talla: M").
- Asegurar que la imagen mostrada sea la de la variante seleccionada.

### 5. Actualizar MiniCarrito (`components/cart/MiniCart.tsx`)
- Mostrar información de variante en el panel flotante.
- Mantener consistencia con la página del carrito.

### 6. Actualizar Página de Producto (`app/products/[id]/ProductClient.tsx`)
- Asegurar que se pase `variantAttributes` al `AddToCartButton`.

### 7. Pruebas y Validación
- Probar agregar múltiples variantes del mismo producto.
- Verificar que se muestren correctamente en carrito y minicarrito.
- Confirmar que checkout maneje variantes correctamente.

## Pasos de Implementación Detallados
1. Modificar `CartItem` interface para incluir `variantAttributes?: Record<string, string>`.
2. Actualizar `useCartStore.ts`:
   - Cambiar `addItem` para buscar por `${id}-${variantId}`.
   - Actualizar `removeItem`, `updateQuantity` para usar la misma lógica.
3. Actualizar `AddToCartButton` para pasar atributos de variante.
4. Actualizar UI del carrito para mostrar atributos.
5. Probar funcionalidad completa.

## Dependencias
- No se requieren nuevas dependencias de npm.
- Cambios afectan store, componentes de carrito y tipos.

## Seguimiento de Progreso
- [x] Actualizar tipos (`types/index.ts`)
- [x] Modificar store (`lib/stores/useCartStore.ts`)
- [x] Actualizar `AddToCartButton.tsx`
- [x] Actualizar `ProductClient.tsx`
- [x] Actualizar `cart/page.tsx`
- [x] Actualizar `MiniCart.tsx`
- [ ] Pruebas de integración
- [ ] Validación final
