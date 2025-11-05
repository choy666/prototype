# Mejoras en la página de producto para navegación y selección de variantes

## Tareas Pendientes

- [ ] Agregar toggle/botón para alternar entre "Producto Original" y "Variantes"
- [ ] Mejorar lógica de selección de atributos para ser más intuitiva
- [ ] Actualizar visualización de selección actual (precio, stock, imagen)
- [ ] Agregar navegación entre variantes similares si existen múltiples
- [ ] Asegurar que el carrito reciba la información correcta (producto base o variante)
- [ ] Probar la funcionalidad completa

## Información Recopilada

- Archivo principal: `app/products/[id]/ProductClient.tsx`
- Ya existe lógica básica para selección de variantes con selects
- Incluye opción "Producto Original" en los selects
- Hay auto-selección al clic en imagen de variante
- Schema soporta variantes con attributes, price, stock, image, isActive

## Plan de Implementación

1. Modificar `ProductClient.tsx` para agregar toggle de selección
2. Mejorar la lógica de `selectedVariant` y `getAvailableOptions`
3. Actualizar la UI para mostrar claramente la selección
4. Agregar navegación opcional entre variantes
5. Verificar integración con carrito
