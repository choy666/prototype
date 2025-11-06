# Plan para quitar "Vista Rápida de Variantes" en app/admin/products/id/edit

## Información Recopilada
- Archivo principal: `app/admin/products/[id]/edit/page.tsx`
- La pestaña "variants" contiene:
  - Un Collapsible "Vista Rápida de Variantes" con formulario para editar variantes generadas automáticamente.
  - Componente `ProductVariants` para gestión completa de variantes.
- Lógica automática de generación de variantes basada en atributos dinámicos.
- Vista previa muestra variantes generadas.

## Plan de Cambios
1. Quitar el Collapsible "Vista Rápida de Variantes" de la pestaña "variants".
2. Eliminar la lógica de generación automática de `form.variants`.
3. Remover `variants` del estado del formulario y interfaces.
4. Ajustar la vista previa para no mostrar variantes generadas.
5. Mantener únicamente el componente `ProductVariants`.

## Pasos de Implementación
- [x] Editar `app/admin/products/[id]/edit/page.tsx` para quitar lógica de variants automática.
- [x] Quitar Collapsible "Vista Rápida de Variantes".
- [x] Ajustar vista previa.
- [x] Verificar que solo quede `ProductVariants`.

## Archivos Dependientes
- Ninguno adicional.

## Pasos de Seguimiento
- [ ] Probar la página de edición después de cambios.
- [ ] Verificar que las variantes se gestionen solo a través de `ProductVariants`.
