# Tareas para mostrar variantes activas en todos los productos

## Información del problema
- Las variantes del producto ID 23 se muestran porque tienen atributos.
- Para ID 27, la sección no aparece porque availableAttributes está vacío (sin atributos en variantes).
- Solución: Cambiar condición de renderizado a hasActiveVariants (cualquier variante activa), para mostrar Select por nombre incluso sin atributos.

## Pasos del plan
- [x] 1. En app/products/[id]/ProductClient.tsx: Agregar const hasActiveVariants = product.variants?.some(v => v.isActive) ?? false; después de los useState.
- [x] 2. Cambiar la condición if (Object.keys(availableAttributes).length > 0) a if (hasActiveVariants) para la sección "Selección de producto".
- [x] 3. Mantener availableAttributes para selects de atributos si existen, pero asegurar que el Select muestre solo activas (ya filtrado).
- [x] 4. Verificar en navegador: Recargar /products/27 y confirmar que aparece la sección con variantes por nombre.
- [x] 5. Si OK, marcar completado y cerrar tarea.

Dependencias: Ninguna. Solo editar ProductClient.tsx.
