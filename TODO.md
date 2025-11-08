# TODO: Solución para acceso a página de stock en admin

## Pasos del plan aprobado

1. [x] Editar app/admin/products/[id]/stock/page.tsx:
   - [x] Agregar guards safe en el map de variants: usar Object.entries(variant.attributes || {}) para evitar throws si attributes es null/undefined.
   - [x] Agregar fallback 'Sin atributos' si no hay entries.
   - [x] En el map de stockLogs, usar new Date(log.created_at || new Date()) para manejar null.
   - [x] Opcional: agregar console.error en useEffect después de setVariants si hay variants con attributes inválidos.

2. [x] Probar la página:
   - [x] Navegar a /admin/products/24/stock después de login como admin.
   - [x] Verificar que carga sin error genérico: muestra producto, variants (con attributes safe), y logs.
   - [x] Probar edge cases: ID sin variants (debe mostrar [] sin crash), ID sin logs ([] OK), ID inválido (fetchError OK).

3. [x] Verificar logs/consola: no hay errores en client/server al cargar.

4. [x] Si OK, marcar completado y limpiar TODO.md.
