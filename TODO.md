# Plan de Implementación: Quitar Opción de Buscar Variantes

## Información Recopilada
- El componente `ProductVariants.tsx` incluye una barra de búsqueda con un input que filtra variantes por atributos y precio.
- También hay filtros de estado (Todas, Activas, Inactivas) que se mantendrán.
- La funcionalidad de búsqueda se implementa mediante el estado `searchTerm` y la lógica de filtrado en `filteredVariants`.

## Plan de Implementación
- Eliminar el input de búsqueda y el ícono de búsqueda de la barra de filtros.
- Remover el estado `searchTerm` y su manejo.
- Modificar la lógica de `filteredVariants` para quitar el filtro de búsqueda, manteniendo solo el filtro por estado (activo/inactivo).
- Ajustar el mensaje de "No hay variantes" para que no mencione filtros de búsqueda.
- Mantener la funcionalidad de mostrar variantes existentes, crear nuevas variantes y los filtros de estado.

## Archivos a Modificar
- `components/admin/ProductVariants.tsx`

## Pasos de Seguimiento
- Verificar que la página cargue correctamente sin errores.
- Probar que las variantes se muestren y se puedan crear/editar sin problemas.
- Confirmar que los filtros de estado funcionen correctamente.

## Estado de Tareas
- [ ] Eliminar estado `searchTerm` y su setter
- [ ] Eliminar input de búsqueda de la barra de filtros
- [ ] Modificar lógica de `filteredVariants` para quitar filtro de búsqueda
- [ ] Ajustar mensaje de "No hay variantes" para no mencionar búsqueda
- [ ] Verificar funcionamiento de la página
- [ ] Probar creación y edición de variantes
- [ ] Confirmar filtros de estado funcionan correctamente
