# Mejoras para Subida de Imágenes Adicionales

## Información Recopilada
- Actualmente en `app/admin/products/new/page.tsx` y `app/admin/products/[id]/edit/page.tsx`, las imágenes adicionales se manejan como un campo de texto simple donde el usuario ingresa URLs separadas por coma
- Existen componentes `ImageUpload` y `ImageReorder` que permiten subir imágenes con drag & drop y reordenarlas, pero no se usan en los formularios de productos
- El componente `ImageUpload` soporta subida de archivos y URLs, con vista previa y eliminación
- El componente `ImageReorder` permite agregar URLs manualmente y reordenar imágenes existentes

## Plan de Mejoras para Imágenes Adicionales
1. **Reemplazar campo de texto por componente visual**: Usar `ImageReorder` para una mejor UX en la gestión de imágenes adicionales
2. **Actualizar página de creación de productos**: Modificar `app/admin/products/new/page.tsx` para usar el componente `ImageReorder`
3. **Actualizar página de edición de productos**: Modificar `app/admin/products/[id]/edit/page.tsx` para usar el componente `ImageReorder`
4. **Mantener compatibilidad**: Asegurar que los datos existentes sigan funcionando
5. **Agregar funcionalidad de reordenamiento**: Permitir cambiar el orden de las imágenes adicionales

## Pasos de Implementación

### 1. Actualizar Página de Creación de Productos
- [x] Modificar `app/admin/products/new/page.tsx`:
  - Importar `ImageReorder` component
  - Reemplazar el campo de input de texto para `images` por el componente `ImageReorder`
  - Actualizar el estado `form.images` de `string` a `string[]`
  - Actualizar `handleChange` para manejar arrays de imágenes
  - Actualizar `handleSubmit` para enviar el array directamente

### 2. Actualizar Página de Edición de Productos
- [x] Modificar `app/admin/products/[id]/edit/page.tsx`:
  - Importar `ImageReorder` component
  - Reemplazar el campo de input de texto para `images` por el componente `ImageReorder`
  - Actualizar el estado `form.images` de `string` a `string[]`
  - Actualizar lógica de carga inicial para convertir string separado por coma a array
  - Actualizar `handleChange` para manejar arrays de imágenes
  - Actualizar `handleSubmit` para enviar el array directamente

### 3. Verificar Compatibilidad de Datos
- [x] Asegurar que la API `/api/admin/products` maneje arrays de imágenes correctamente
- [x] Verificar que los productos existentes con imágenes separadas por coma sigan funcionando
- [x] Probar migración de datos existentes

### 4. Testing y Validación
- [ ] Probar creación de productos con imágenes adicionales usando el nuevo componente
- [ ] Probar edición de productos existentes con imágenes
- [ ] Verificar funcionalidad de reordenamiento
- [ ] Testear subida de URLs válidas e inválidas
- [ ] Validar límites de cantidad de imágenes

## Archivos a Modificar
- `app/admin/products/new/page.tsx` - Reemplazar campo de texto por `ImageReorder`
- `app/admin/products/[id]/edit/page.tsx` - Reemplazar campo de texto por `ImageReorder`
- Posiblemente `app/api/admin/products/route.ts` si necesita ajustes para arrays

## Beneficios Esperados
- Mejor experiencia de usuario para gestionar imágenes adicionales
- Interfaz más intuitiva y visual
- Posibilidad de reordenar imágenes fácilmente
- Validación visual de URLs
- Reducción de errores en la entrada de URLs
