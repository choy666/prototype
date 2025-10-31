# Plan de Implementación: Navbar Unificada Adaptable por Rol

## Información Recopilada
- **Navbar Actual para Usuarios**: `components/ui/Navbar.tsx` - Navbar horizontal con navegación básica (Inicio, Productos, Carrito, etc.)
- **Navbar Actual para Admin**: `components/admin/AdminNavbar.tsx` - Sidebar vertical con navegación específica de admin
- **Layouts**:
  - `app/layout.tsx`: Usa Navbar.tsx para todos los usuarios
  - `app/admin/layout.tsx`: Usa AdminNavbar.tsx solo para admin, con padding lateral para sidebar
- **Roles**: 'admin' y 'user' (basado en session.user.role)
- **Requisito**: Una sola navbar que cambie completamente según el rol del usuario

## Plan de Implementación
1. **Modificar Navbar.tsx para ser adaptable por rol**
   - Agregar lógica condicional basada en session.user.role
   - Para rol 'admin': Mostrar navegación completa de admin (Dashboard, Productos, Categorías, Pedidos, Usuarios, Reportes, Configuración)
   - Para rol 'user': Mostrar navegación básica (Inicio, Productos, Mi Cuenta)
   - Ocultar elementos no relevantes (ej: carrito para admin)

2. **Actualizar app/admin/layout.tsx**
   - Reemplazar AdminNavbar con la nueva Navbar adaptable
   - Remover padding lateral (md:pl-72) ya que no hay sidebar
   - Ajustar estructura del layout

3. **Eliminar componentes obsoletos**
   - Eliminar `components/admin/AdminNavbar.tsx` después de verificar funcionamiento

4. **Pruebas y ajustes**
   - Verificar navegación para ambos roles
   - Asegurar responsive design
   - Probar en móvil y desktop

## Pasos Detallados
- [ ] Modificar `components/ui/Navbar.tsx` para incluir navegación condicional por rol
- [ ] Actualizar `app/admin/layout.tsx` para usar Navbar y remover padding
- [ ] Eliminar `components/admin/AdminNavbar.tsx`
- [ ] Probar navegación en ambos roles
- [ ] Ajustar estilos si es necesario

## Archivos a Modificar
- `components/ui/Navbar.tsx`
- `app/admin/layout.tsx`
- Eliminar: `components/admin/AdminNavbar.tsx`

## Archivos a Verificar
- `app/layout.tsx` (debe seguir usando Navbar.tsx)
- `app/(protected)/dashboard/page.tsx` (verificar redirecciones)
