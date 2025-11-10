# TODO: Implementación de Creación de Nueva Variante

## Información Recopilada
- **API Route**: `app/api/admin/products/[id]/variants/route-new.ts` maneja la creación de variantes con schema de validación.
- **Componente UI**: `components/admin/ProductVariantsNew.tsx` tiene el formulario de creación de variantes.
- **Manejo de Imágenes**: `components/ui/ImageReorder.tsx` se usa para imágenes adicionales en productos, puede reciclarse para variantes.
- **Campos Requeridos**:
  - Nombre de la Variante (obligatorio)
  - Precio Específico (obligatorio)
  - Atributos Heredados del Padre (obligatorio, mostrar solo)
  - Imágenes (obligatorio, usar ImageReorder)
  - Stock Inicial (obligatorio)

## Plan de Implementación

### 1. Actualizar Schema de Validación en API
- Modificar `createVariantSchema` en `route-new.ts` para hacer obligatorios:
  - `name`: string (no optional)
  - `price`: string (no optional)
  - `images`: array (no optional, mínimo 1 imagen)
  - `stock`: number (ya es obligatorio)

### 2. Actualizar Componente ProductVariantsNew.tsx
- Agregar campo de imágenes usando `ImageReorder`
- Marcar campos obligatorios con asterisco (*)
- Asegurar que atributos heredados se muestren correctamente
- Actualizar estado del formulario para incluir imágenes
- Validar que se complete al menos una imagen

### 3. Pruebas y Verificación
- Verificar que la creación funcione correctamente
- Probar validaciones del lado cliente y servidor
- Confirmar que las imágenes se guarden correctamente

## Pasos Detallados

1. **Editar API Schema** (`app/api/admin/products/[id]/variants/route-new.ts`)
   - Cambiar `name: z.string().optional()` → `name: z.string()`
   - Cambiar `price: z.string().optional()` → `price: z.string()`
   - Cambiar `images: z.array(z.string()).optional()` → `images: z.array(z.string()).min(1)`

2. **Editar Componente UI** (`components/admin/ProductVariantsNew.tsx`)
   - Importar `ImageReorder`
   - Agregar estado para imágenes en `newVariantForm`
   - Agregar campo de imágenes en el formulario
   - Agregar validación de imágenes requeridas
   - Actualizar handlers para imágenes

3. **Testing**
   - Crear variante con todos los campos
   - Verificar errores de validación
   - Confirmar guardado correcto
