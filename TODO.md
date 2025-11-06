# Plan de Implementación: Atributos con Un Solo Valor

## Pasos a Completar

- [x] Actualizar interfaz DynamicAttribute en AttributeBuilder.tsx (cambiar values: string[] a value: string)
- [x] Modificar lógica de agregar atributo en AttributeBuilder.tsx (input simple, no split por comas)
- [x] Actualizar modo de edición en AttributeBuilder.tsx (solo editar el valor existente, sin agregar/remover valores)
- [x] Actualizar visualización de atributos en AttributeBuilder.tsx (mostrar un solo badge/texto)
- [x] Actualizar page.tsx para usar nueva interfaz DynamicAttribute
- [x] Agregar lógica de migración en page.tsx (tomar primer valor si hay múltiples en atributos existentes)
- [x] Simplificar generateCombinations en page.tsx para una sola variante por atributo
- [x] Actualizar vista previa en page.tsx para mostrar atributos como pares clave-valor simples
- [ ] Probar cambios: Cargar producto existente, editar atributos, guardar y verificar variantes
- [ ] Ejecutar npm run build para validar tipos TypeScript
