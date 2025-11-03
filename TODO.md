# Plan de Implementación: Gestión de Variantes y Atributos en Edición de Productos

## Información Recopilada
- **Página actual de edición**: `app/admin/products/[id]/edit/page.tsx` maneja solo campos básicos del producto
- **Componentes existentes**: `ProductVariants.tsx` y `AttributeBuilder.tsx` para gestión de variantes y atributos
- **Esquema DB**: Tablas `productAttributes` y `productVariants` disponibles
- **Acciones**: `lib/actions/productVariants.ts` con funciones CRUD para variantes
- **API**: `app/api/admin/products/[id]/variants/route.ts` para operaciones de variantes

## Plan de Implementación

### 1. Actualizar Página de Edición de Productos
- [x] Agregar sección de atributos dinámicos usando `AttributeBuilder`
- [x] Agregar sección de variantes usando `ProductVariants`
- [x] Integrar ambos componentes en el formulario de edición
- [x] Asegurar que los datos se carguen correctamente al editar

### 2. Actualizar API de Productos
- [x] Modificar `app/api/admin/products/[id]/route.ts` para manejar atributos junto con el producto
- [x] Crear endpoint para guardar atributos del producto
- [x] Actualizar validaciones para incluir atributos

### 3. Actualizar Acciones de Productos
- [x] Modificar `lib/actions/products.ts` para manejar atributos
- [x] Agregar funciones para crear/actualizar atributos del producto

### 4. Actualizar Esquema de Base de Datos (si necesario)
- [ ] Verificar si se necesita relación producto-atributos
- [ ] Crear tabla intermedia si es necesario para atributos por producto

### 5. Testing y Validación
- [ ] Probar creación de atributos y variantes
- [ ] Probar edición de producto con variantes existentes
- [ ] Verificar que los datos se guarden correctamente

## Pasos de Implementación Detallados

1. **Paso 1**: Modificar `app/admin/products/[id]/edit/page.tsx`
   - [x] Importar `AttributeBuilder` y `ProductVariants`
   - [x] Agregar estado para atributos y variantes
   - [x] Agregar secciones en el formulario
   - [ ] Actualizar `handleSubmit` para guardar atributos y variantes

2. **Paso 2**: Actualizar `lib/actions/products.ts`
   - Agregar funciones para manejar atributos del producto
   - Crear función `updateProductWithAttributes`

3. **Paso 3**: Modificar API `app/api/admin/products/[id]/route.ts`
   - Actualizar PUT endpoint para aceptar atributos
   - Agregar lógica para guardar atributos junto con el producto

4. **Paso 4**: Testing
   - Verificar que todo funcione en la interfaz
   - Probar con datos reales

## Dependencias
- `AttributeBuilder` depende de `ProductVariants` para mostrar atributos disponibles
- Variantes dependen de atributos definidos para el producto
- API necesita manejar tanto producto como atributos/variantes
