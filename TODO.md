# Plan de Implementación: Mejora de Visualización de Imágenes en Edición de Productos

## Información Recopilada
- Archivo principal: `app/admin/products/[id]/edit/page.tsx` - Página de edición de productos con formulario y manejo de imágenes.
- Componente clave: `components/ui/ImageReorder.tsx` - Maneja la lista de imágenes adicionales, permite reordenar, agregar y eliminar.
- Las imágenes se muestran en una cuadrícula, pero actualmente son miniaturas básicas sin previsualización clara.
- La imagen principal se maneja por separado en un campo de input URL.

## Plan Detallado
1. **Modificar ImageReorder.tsx para miniaturas compactas con previsualización**
   - Cambiar el diseño de la cuadrícula para mostrar miniaturas más pequeñas.
   - Agregar overlay con zoom o previsualización al hacer hover.
   - Mejorar indicadores visuales (número de orden, estado de carga).

2. **Asegurar visibilidad de la imagen principal**
   - Agregar una sección dedicada para mostrar la imagen principal junto al campo de input.
   - Mostrar miniatura con opción de zoom/previsualización.

3. **Propuestas Adicionales de Mejora**
   - Implementar lazy loading para las imágenes.
   - Agregar indicadores de carga (skeleton loaders).
   - Opción de zoom modal al hacer click en la imagen.
   - Mejorar accesibilidad con alt texts descriptivos.
   - Agregar validación de URLs de imágenes.

## Pasos de Implementación
- [ ] Modificar `components/ui/ImageReorder.tsx` para miniaturas compactas
- [ ] Agregar funcionalidad de previsualización (hover zoom)
- [ ] Actualizar `app/admin/products/[id]/edit/page.tsx` para mostrar imagen principal con miniatura
- [ ] Implementar lazy loading y indicadores de carga
- [ ] Agregar modal de zoom para imágenes
- [ ] Mejorar validaciones y accesibilidad
- [ ] Probar la funcionalidad en el navegador

## Seguimiento de Progreso
- Fecha de inicio: [Fecha actual]
- Estado: En progreso
