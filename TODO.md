# TODO: Quitar Atributos Dinámicos de Creación de Productos

## Información Gathered
- La página `app/admin/products/new/page.tsx` incluye funciones de Atributos Dinámicos usando `AttributeBuilder`, genera variantes automáticamente basadas en `dynamicAttributes`, y muestra una sección de Variantes en el formulario.
- La página `app/admin/products/[id]/edit/page.tsx` mantiene los Atributos Dinámicos en una pestaña separada ("Atributos") y usa `ProductVariants` para gestionar variantes existentes.
- El objetivo es eliminar completamente las funciones de atributos dinámicos de la creación de productos, dejando solo la edición con estas funcionalidades.

## Plan
- [ ] Quitar import de `AttributeBuilder` en `app/admin/products/new/page.tsx`
- [ ] Eliminar el estado `dynamicAttributes` del `ProductForm` interface y del estado inicial `form`
- [ ] Remover el `useEffect` que genera combinaciones de variantes basadas en `dynamicAttributes`
- [ ] Eliminar la sección "Atributos Dinámicos" del formulario (el componente `AttributeBuilder`)
- [ ] Eliminar la sección "Variantes" del formulario (ya que sin atributos dinámicos no hay variantes automáticas)
- [ ] Ajustar el `handleSubmit` para no enviar `dynamicAttributes` ni crear variantes automáticamente
- [ ] Verificar que la página de edición siga funcionando correctamente con atributos dinámicos

## Dependent Files to be edited
- `app/admin/products/new/page.tsx`

## Followup steps
- [ ] Probar la creación de productos sin atributos dinámicos
- [ ] Verificar que la edición de productos conserve las funciones de atributos dinámicos
- [ ] Asegurar que no haya errores en la consola o funcionalidades rotas
