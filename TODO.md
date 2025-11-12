# TODO: Corregir selección de variantes en app/products/[id]

## Pasos a completar:

1. **Corregir bug en ProductClient.tsx**: Cambiar el `useMemo` incorrecto a `useEffect` para actualizar `currentImageIndex` cuando se selecciona una variante con imagen.
   - ✅ Completado: Cambié `useMemo` a `useEffect` en la línea 127.

2. **Mejorar visualización del stock**: Agregar visualización del stock específico de la variante seleccionada en la sección "Características de la variante".
   - ✅ Completado: Agregué un campo adicional para mostrar el stock de la variante en la sección de características.

3. **Verificar funcionalidad**: Asegurar que al seleccionar una variante, se muestre su precio (ya funciona), stock e imágenes correspondientes.
   - ✅ Verificado: El precio ya se actualiza correctamente con `currentPrice`, el stock se muestra en la sección de características, y las imágenes se actualizan con el `useEffect`.

4. **Probar la implementación**: Ejecutar la aplicación y verificar que la selección de variantes funcione correctamente.
   - Pendiente: Necesita ser probado en el navegador.
