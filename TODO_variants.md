# Implementación de Variantes de Productos

## Estado Actual
- ✅ Tablas `product_attributes` y `product_variants` definidas en schema.ts
- ✅ Acciones en `lib/actions/productVariants.ts` implementadas
- ✅ Componentes admin `ProductAttributes.tsx` y `ProductVariants.tsx` existentes
- ✅ APIs para atributos y variantes funcionando

## Plan de Implementación

### 1. Modificar Página de Creación de Productos (Admin)
- [x] Actualizar `app/admin/products/new/page.tsx` para incluir:
  - Selección de atributos existentes (talla, color, etc.)
  - Generación automática de combinaciones de variantes
  - Formulario para configurar stock y precios por variante
  - Integración con `ProductVariants` component

### 2. Actualizar Página de Detalles del Producto (Frontend)
- [x] Modificar `app/products/[id]/ProductClient.tsx` para:
  - Mostrar variantes disponibles (talla, color)
  - Permitir selección de variante
  - Actualizar precio y stock según variante seleccionada
  - Actualizar imagen si la variante tiene imagen específica

### 3. Actualizar Sistema de Carrito
- [x] Modificar `AddToCartButton` para incluir variante seleccionada
- [x] Actualizar tipos en `types/index.ts` para incluir variante en cart items
- [x] Actualizar lógica de stock para considerar variantes

### 4. Actualizar APIs y Acciones
- [x] Revisar y actualizar `lib/actions/products.ts` para incluir variantes
- [x] Actualizar `app/api/products/[id]/route.ts` para devolver variantes
- [x] Asegurar que el stock total considere variantes activas

### 5. Testing y Validación
- [ ] Probar creación de productos con variantes
- [ ] Probar selección de variantes en frontend
- [ ] Probar flujo de compra con variantes
- [ ] Validar cálculos de stock y precios

