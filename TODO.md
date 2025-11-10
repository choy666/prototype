# TODO: Agregar Atributos Exclusivos a Variantes

## Información Recopilada
- La tabla `productVariants` ya tiene `additionalAttributes: jsonb("additional_attributes")` para atributos específicos de variante.
- El componente `ProductVariantsNew.tsx` maneja creación y edición de variantes, pero no incluye UI para `additionalAttributes`.
- La API en `route.ts` ya soporta `additionalAttributes` en POST y PUT.
- `AttributeBuilder.tsx` existe pero es para atributos dinámicos con múltiples valores; necesitamos algo más simple para clave-valor.

## Plan
1. Crear un componente simple `AdditionalAttributesBuilder` para manejar atributos clave-valor en `ProductVariantsNew.tsx`.
2. Agregar el campo `AdditionalAttributesBuilder` al formulario de creación de variantes.
3. Agregar el campo `AdditionalAttributesBuilder` al formulario de edición de variantes.
4. Actualizar el display de variantes para mostrar los `additionalAttributes`.
5. Verificar que la API maneje correctamente los datos.

## Pasos a Completar
- [ ] Modificar `ProductVariantsNew.tsx` para incluir `AdditionalAttributesBuilder` en creación
- [ ] Modificar `ProductVariantsNew.tsx` para incluir `AdditionalAttributesBuilder` en edición
- [ ] Actualizar el display de variantes para mostrar atributos adicionales
- [ ] Probar la funcionalidad completa
