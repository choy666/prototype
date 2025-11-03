# Plan de Unificación de Estilos en Formularios de Admin

## Información Recopilada
- Análisis de páginas de formularios: new product, edit product, new category, edit category
- Estilos actuales inconsistentes: labels personalizados, selects con clases inline, textareas con clases inline
- Componentes shadcn/ui disponibles: Input, Label, Select (verificado)
- Faltante: componente Textarea para consistencia

## Plan de Implementación
### 1. Crear componente Textarea
- Crear `components/ui/textarea.tsx` basado en shadcn/ui para reemplazar textareas inline

### 2. Actualizar página de nuevo producto (app/admin/products/new/page.tsx)
- Reemplazar `<label>` con `<Label>` de shadcn
- Usar `<Select>` para categoría
- Usar `<Textarea>` para descripción
- Mantener Input para otros campos
- Unificar clases de contenedores

### 3. Actualizar página de editar producto (app/admin/products/[id]/edit/page.tsx)
- Aplicar mismos cambios que en new product

### 4. Actualizar páginas de categorías
- new category (app/admin/categories/new/page.tsx)
- edit category (app/admin/categories/[id]/edit/page.tsx)
- Usar Label y Textarea consistentes

### 5. Verificar consistencia
- Asegurar que todos los formularios usen los mismos estilos
- Probar funcionalidad

## Archivos a Modificar
- components/ui/textarea.tsx (nuevo)
- app/admin/products/new/page.tsx
- app/admin/products/[id]/edit/page.tsx
- app/admin/categories/new/page.tsx
- app/admin/categories/[id]/edit/page.tsx

## Dependencias
- Ninguna nueva instalación requerida
- Usar componentes existentes de shadcn/ui

## Seguimiento de Progreso
- [ ] Crear componente Textarea
- [ ] Actualizar new product page
- [ ] Actualizar edit product page
- [ ] Actualizar new category page
- [ ] Actualizar edit category page
- [ ] Verificar consistencia
