# TODO: Implementación de Variantes de Productos, Precios, Ofertas, Carrito, Checkout y Control de Stock

## Información Recopilada
- **Esquema Actual**: Productos tienen precio, descuento (porcentaje), stock. Variantes tienen precio opcional, stock, imagen, atributos.
- **Carrito**: Ya soporta variantId y variantAttributes en CartItem (store), pero cartItems en BD solo tiene productId.
- **Precios**: Necesita lógica para usar precio de variante si existe, sino precio de producto, aplicando descuento del producto padre.
- **Stock**: Deducción debe ser de variante si seleccionada, sino del producto.
- **Checkout**: Actualmente calcula precios con descuento, pero no maneja variantes.
- **Lado Usuario**: Página de producto debe permitir selección de variante.
- **Lado Admin**: Formularios para gestionar variantes.

## Plan de Implementación
### 1. Actualizar Esquema de Base de Datos
- [x] Agregar campo `variantId` opcional a tabla `cartItems` para referenciar variante seleccionada.
- [x] Agregar campo `variantId` opcional a tabla `orderItems` para referenciar variante seleccionada.
- [x] Crear migración Drizzle para actualizar esquema.

### 2. Actualizar Lógica de Precios y Ofertas
- [x] Modificar `lib/utils/pricing.ts` para calcular precio final: si variante tiene precio usar ese, sino precio producto, aplicar descuento.
- [x] Actualizar `useCartStore.ts` para usar lógica de precios correcta en `totalPrice` (ya implementado).
- [x] Asegurar que ofertas (descuentos) se hereden de producto padre a variantes.

### 3. Actualizar Gestión de Carrito
- [x] Modificar acciones de carrito (`lib/actions/cart.ts` si existe, o crear) para manejar variantId al agregar/remover items.
- [x] Actualizar `AddToCartButton.tsx` para incluir variantId y atributos al agregar al carrito.
- [x] Modificar `MiniCart.tsx` y `CartProvider.tsx` para mostrar atributos de variante.

### 4. Actualizar Checkout y Deducción de Stock
- [x] Modificar `app/api/checkout/route.ts` para incluir variantId en items y calcular precios correctamente.
- [x] Crear función en `lib/actions/stock.ts` para deducir stock de variante o producto según corresponda.
- [x] Integrar deducción de stock en webhook de pago exitoso (`app/api/webhooks/route.ts`).

### 5. Lado Usuario: Selección de Variantes
- [x] Actualizar `app/products/[id]/ProductClient.tsx` para mostrar opciones de variantes (atributos, imágenes).
- [x] Agregar estado para variante seleccionada y actualizar precio/imagen dinámicamente.
- [x] Modificar `ProductCard.tsx` para mostrar precio de variante si aplica.

### 6. Lado Admin: Gestión de Variantes
- [x] Actualizar `components/admin/ProductVariants.tsx` para crear/editar variantes con precio, stock, imagen.
- [x] Modificar páginas admin de productos para incluir gestión de variantes.
- [x] Actualizar `lib/actions/productVariants.ts` si necesario para validaciones.

### 7. Actualizar Validaciones y Tipos
- [x] Actualizar `lib/validations/checkout.ts` para incluir variantId en items.
- [x] Actualizar tipos en `types/index.ts` para CartItem con variantId.

## Archivos Dependientes a Editar
- `lib/schema.ts`: Agregar variantId a cartItems.
- `lib/stores/useCartStore.ts`: Ya tiene variantId, verificar lógica de precios.
- `lib/actions/products.ts`: Actualizar getProductById para incluir variantes.
- `lib/actions/stock.ts`: Agregar función para deducir stock de variante.
- `app/api/checkout/route.ts`: Manejar variantes en cálculo de precios.
- `app/products/[id]/ProductClient.tsx`: Agregar selección de variante.
- `components/cart/AddToCartButton.tsx`: Pasar variantId.
- `components/admin/ProductVariants.tsx`: Mejorar gestión.

## Pasos de Seguimiento
- [x] Ejecutar migración de BD después de cambios en esquema.
- [x] Probar flujo completo: agregar variante al carrito, checkout, verificación de stock.
- [ ] Verificar que precios se calculen correctamente en carrito y checkout.
- [ ] Asegurar compatibilidad con ofertas (descuentos).
- [ ] Probar desde lado usuario y admin.
