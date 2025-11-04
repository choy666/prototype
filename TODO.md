# TODO: Implementación de Selección de Variantes en Producto

## Problema Actual
En la página `app/products/[id]`, al seleccionar una imagen del carrusel que corresponde a una variante, los checkboxes (Select components) de variantes no se actualizan automáticamente para reflejar la variante seleccionada. Además, los selects de variantes no incluyen una opción para seleccionar el "producto original" (sin variantes), lo que limita la experiencia del usuario.

## Objetivos
- Corregir la sincronización entre la selección de imágenes de variantes y los selects de atributos.
- Agregar una opción "Producto Original" en cada select de variante para permitir al usuario elegir entre el producto base o variantes específicas.
- Mejorar la experiencia de usuario con indicadores visuales y feedback claro.

## Tareas de Implementación

### 1. Agregar Opción "Producto Original" en Selects de Variantes
- **Archivo:** `app/products/[id]/ProductClient.tsx`
- **Cambios:**
  - Modificar `getAvailableOptions` para incluir una opción "Producto Original" al inicio de cada lista de opciones.
  - Actualizar la lógica de selección para manejar el caso cuando se selecciona "Producto Original" (limpiar `selectedAttributes`).
  - Asegurar que al seleccionar "Producto Original", se resetee la variante seleccionada y se muestre la imagen principal del producto.

### 2. Corregir Sincronización de Selects al Seleccionar Imagen de Variante
- **Archivo:** `app/products/[id]/ProductClient.tsx`
- **Cambios:**
  - Verificar que el `onClick` de las miniaturas de variantes actualice correctamente `selectedAttributes`.
  - Agregar un `useEffect` para forzar la actualización de los Selects cuando `selectedAttributes` cambie.
  - Asegurar que los Selects reflejen la variante seleccionada incluso si se cambia manualmente después.

### 3. Mejorar Indicadores Visuales de Selección
- **Archivo:** `app/products/[id]/ProductClient.tsx`
- **Cambios:**
  - Agregar un indicador visual (badge o texto) que muestre "Variante Seleccionada" cuando hay una variante activa.
  - Resaltar el select correspondiente cuando se selecciona una variante desde el carrusel.
  - Mostrar un mensaje cuando se selecciona "Producto Original" para confirmar la selección.

### 4. Actualizar Lógica de Precios y Stock
- **Archivo:** `app/products/[id]/ProductClient.tsx`
- **Cambios:**
  - Asegurar que al seleccionar "Producto Original", se use el precio y stock del producto base.
  - Verificar que `currentPrice` y `currentStock` se actualicen correctamente en todos los casos.

### 5. Agregar Validación y Feedback
- **Archivo:** `app/products/[id]/ProductClient.tsx`
- **Cambios:**
  - Agregar validación para evitar selecciones inválidas (ej: variante no disponible).
  - Mostrar mensajes de error o advertencia si una variante no está disponible.
  - Implementar feedback visual (loading states) durante la selección.

### 6. Pruebas y Verificación
- **Tareas:**
  - Probar la selección de imágenes de variantes y verificar que los selects se actualicen.
  - Probar la opción "Producto Original" y confirmar que resetea la selección.
  - Verificar en diferentes dispositivos y tamaños de pantalla.
  - Probar con productos que tienen múltiples variantes y atributos.

### 7. Recomendaciones Adicionales
- **Mejora de UX:** Agregar tooltips en las miniaturas para explicar qué hace cada imagen (principal, secundaria, variante).
- **Optimización:** Implementar lazy loading para imágenes de variantes si hay muchas.
- **Accesibilidad:** Asegurar que los selects y botones tengan labels adecuados y sean navegables por teclado.
- **Analytics:** Agregar tracking para ver qué opciones seleccionan los usuarios (producto original vs variantes).
- **Compatibilidad:** Verificar que funcione correctamente con productos que no tienen variantes.

## Estado de Implementación
- [x] 1. Agregar Opción "Producto Original"
- [x] 2. Corregir Sincronización de Selects
- [x] 3. Mejorar Indicadores Visuales
- [ ] 4. Actualizar Lógica de Precios y Stock
- [ ] 5. Agregar Validación y Feedback
- [ ] 6. Pruebas y Verificación
- [ ] 7. Recomendaciones Adicionales

## Notas Técnicas
- Usar `useEffect` para sincronizar cambios en `selectedAttributes`.
- Mantener la lógica de `getAvailableOptions` para filtrar opciones válidas.
- Asegurar compatibilidad con el componente `AddToCartButton` que recibe `variantId` y `variantAttributes`.
