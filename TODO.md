# TODO: Implementar Botón de Agregar Imagen y Visualización para Imagen Principal en app/admin/products/new

## Información Recopilada
- **Archivo principal**: `app/admin/products/new/page.tsx`
- **Componente de imágenes adicionales**: `components/ui/ImageReorder.tsx` (maneja múltiples imágenes con input URL, botón "Agregar", preview, reordenar, remover)
- **Estado actual**: `image: string` para imagen principal, solo input simple de URL sin preview ni botón dedicado
- **Estado adicional**: `images: string[]` para imágenes adicionales, usando ImageReorder
- **Objetivo**: Implementar funcionalidad similar a imágenes adicionales para la imagen principal (botón agregar, preview, posibilidad de remover)

## Plan de Implementación
1. **Crear componente ImageSingle.tsx**: Componente basado en ImageReorder pero limitado a una sola imagen, con input URL, botón "Agregar", preview y botón remover
2. **Actualizar page.tsx**: Reemplazar el input simple de imagen principal por el nuevo componente ImageSingle
3. **Ajustar manejadores de estado**: Crear funciones handleImageAdd, handleImageRemove para la imagen principal (similar a las de adicionales)
4. **Pruebas**: Verificar que la funcionalidad funcione correctamente en el formulario

## Pasos Detallados
- [x] Crear `components/ui/ImageSingle.tsx` basado en ImageReorder.tsx
  - [x] Adaptar lógica para manejar una sola imagen (string en lugar de array)
  - [x] Mantener input URL y botón "Agregar"
  - [x] Agregar preview de imagen cuando se agregue
  - [x] Agregar botón para remover imagen
  - [x] Incluir validación de URL y toasts de éxito/error
- [x] Modificar `app/admin/products/new/page.tsx`
  - [x] Importar ImageSingle
  - [x] Reemplazar el div de "Imagen Principal (URL)" por ImageSingle
  - [x] Agregar manejadores: handleMainImageAdd, handleMainImageRemove
  - [x] Actualizar props: onAdd={handleMainImageAdd}, onRemove={handleMainImageRemove}, image={form.image}
- [ ] Probar funcionalidad
  - [ ] Verificar que se pueda agregar imagen principal con botón
  - [ ] Confirmar preview correcto
  - [ ] Probar remover imagen
  - [ ] Asegurar que el formulario envíe la imagen correctamente

## Dependencias
- Depende de: `components/ui/ImageSingle.tsx` (nuevo)
- Archivos afectados: `app/admin/products/new/page.tsx`

## Seguimiento de Progreso
- [x] Paso 1 completado
- [x] Paso 2 completado
- [x] Paso 3 completado
- [ ] Pruebas completadas
