# Lista de Tareas para Implementación del Frontend de Gestión de Productos (Admin)

## Información Recopilada
- **Panel de Administración Básico**: Ya implementado ([x])
- **Layout Administrativo con Navegación**: Ya implementado ([x])
- **Middleware para Roles de Admin**: Ya implementado ([x])
- **Dashboard con Estadísticas Básicas**: Ya implementado ([x])
- **Gestión de Productos (Admin)**: Parcialmente implementado
  - **CRUD Completo de Productos**: Ya implementado (listado, crear, editar, eliminar)
  - **Gestión de Categorías**: Pendiente
  - **Control de Stock**: Implementado en formularios, pero puede mejorarse
  - **Gestión de Imágenes**: Implementado con URLs, pero puede mejorarse con subida de archivos ([xs])

## Archivos Relevantes Analizados
- `app/admin/products/page.tsx`: Listado de productos con búsqueda, paginación y eliminación
- `app/admin/products/new/page.tsx`: Formulario para crear productos
- `app/admin/products/[id]/edit/page.tsx`: Formulario para editar productos
- API endpoints: `app/api/admin/products/`, `app/api/admin/categories/`

## Tareas Pendientes

### 1. Implementar Gestión de Categorías
- [x] Crear página de listado de categorías (`app/admin/categories/page.tsx`)
- [x] Crear formulario para nueva categoría (`app/admin/categories/new/page.tsx`)
- [x] Crear formulario para editar categoría (`app/admin/categories/[id]/edit/page.tsx`)
- [x] Integrar selección de categorías en formularios de productos

### 2. Mejorar Control de Stock
- [x] Agregar funcionalidades de ajuste de stock manual
- [x] Implementar alertas de stock bajo
- [x] Agregar historial de movimientos de stock

### 3. Mejorar Gestión de Imágenes
- [ ] Implementar subida de imágenes a un servicio de almacenamiento (ej: https://postimages.org). Los links de las imagenes estan subidos a postimages.
- [ ] Agregar vista previa de imágenes en formularios
- [ ] Permitir múltiples imágenes con drag & drop

### 4. Verificaciones y Mejoras
- [ ] Verificar validaciones en formularios
- [ ] Agregar confirmaciones para acciones destructivas
- [ ] Implementar manejo de errores mejorado

## Pasos de Seguimiento
- [ ] Instalar dependencias adicionales si es necesario (ej. para subida de imágenes)
- [ ] Probar funcionalidades en desarrollo
- [ ] Verificar integración con API backend
- [ ] Actualizar documentación si es necesario
