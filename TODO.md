# Tareas para Agregar Edición de Atributos Heredados en Variantes

## Información Recopilada
- Las variantes tienen `attributes` (heredados del padre) y `additionalAttributes` (específicos).
- Actualmente, solo se editan `additionalAttributes` en el formulario de edición.
- La API ya permite actualizar `attributes` en variantes sin afectar al padre.
- El componente `ProductVariantsNew.tsx` maneja la edición de variantes.

## Plan
- [ ] Crear componente `InheritedAttributesBuilder` para editar atributos heredados.
- [ ] Agregar sección en formulario de edición para modificar `attributes` de la variante.
- [ ] Inicializar `editForm` con `attributes` de la variante.
- [ ] Agregar nota explicativa sobre que los cambios solo afectan a la variante.

## Archivos a Editar
- `components/admin/ProductVariantsNew.tsx`

## Pasos de Seguimiento
- [ ] Probar la funcionalidad después de implementar.
