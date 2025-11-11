# TODO: Implementar Selección de Variantes por Nombre en Página de Producto

## Pasos del Plan

### 1. Modificar ProductClient.tsx
- [x] Cambiar la sección de selección de variantes: reemplazar los selects de atributos individuales con un select que liste los nombres de las variantes existentes.
- [x] Actualizar la lógica de selectedVariant para seleccionar por nombre de variante en lugar de combinar atributos.
- [x] Agregar estado para la variante seleccionada por nombre (selectedVariantName).
- [x] Mantener el toggle entre Producto Original y Variantes.
- [x] Al seleccionar una variante por nombre, mostrar sus atributos dinámicos en un Collapsible con el mismo estilo que el producto padre.

### 2. Actualizar Tipos
- [x] Agregar propiedad 'name' a la interfaz ProductVariant en types/index.ts.

### 2. Pruebas y Verificación
- [ ] Verificar que el select muestre correctamente los nombres de las variantes.
- [ ] Confirmar que al seleccionar una variante, se muestren sus atributos en Collapsible.
- [ ] Asegurar que el precio, stock e imagen se actualicen correctamente según la variante seleccionada.
- [ ] Probar el toggle entre Producto Original y Variantes.
- [ ] Verificar compatibilidad con AddToCartButton.

### 3. Limpieza y Optimización
- [ ] Remover código comentado o no utilizado relacionado con la selección anterior.
- [ ] Asegurar que la lógica sea eficiente y no cause re-renders innecesarios.
