# TODO: Auditoría y Corrección del Sistema de Stock

## Información Gathered (del Análisis Inicial)
- Funcionamiento: Página de stock permite updates en producto y variantes; usa adjustStock/adjustVariantStock para BD y logs.
- Error: "¡Ups! Algo salió mal" por validaciones fallidas (userId inválido, DB errors) capturado por ErrorBoundary genérico.
- Fortalezas: Soporte variantes, historial logs, validaciones básicas.
- Debilidades: Sin transacciones DB (inconsistencias), logging insuficiente, no chequeo rol admin en actions, UX básica (sin bulk, warnings).
- Entorno: Next.js 15, Drizzle+Neon, auth NextAuth; servidor en :3001 requiere login admin.

## Plan Detallado (por Archivo)
### 1. lib/actions/stock.ts
- [ ] Implementar transacciones DB para atomicidad (update + log en tx).
- [ ] Mejorar validaciones: Chequear rol admin (pasar como param), errores específicos para user/product no encontrados.
- [ ] Agregar logging granular con logger.error en catch, contexto (IDs, reason).
- [ ] Nueva función: bulkAdjustStock para múltiples variantes (UX mejora).

### 2. app/admin/products/[id]/stock/page.tsx
- [ ] En handleConfirmUpdate: Chequear session.user.role === 'admin'.
- [ ] Mejorar fetchData: Try-catch por fetch, manejar 401/404 con toast/redirección específica.
- [ ] Optimistic update: Actualizar UI local, rollback si falla.
- [ ] UX: Warning si newStock < current, paginación historial (>50 logs), bulk checkbox para variantes.

### 3. components/ui/error-boundary.tsx
- [ ] Personalizar fallback para stock: Mensaje específico + botón recargar.
- [ ] En componentDidCatch: Loggear URL y session status.

### 4. lib/schema.ts
- [ ] Agregar índices: stockLogs.created_at, stockLogs.productId para queries rápidas.
- [ ] Opcional: Columna isAdmin en users (usar rol existente por ahora).

### 5. app/api/admin/products/[id]/route.ts (si existe; sino crear)
- [ ] Asegurar auth admin, error específico si producto no encontrado.

### 6. Migraciones y Testing
- [ ] Generar migración para índices (drizzle-kit generate).
- [ ] Testing: Login admin, update stock (producto/variantes), verificar logs BD/consola, no error genérico.
- [ ] Deploy: Actualizar migraciones, test staging.

## Archivos Dependientes
- Principal: lib/actions/stock.ts, app/admin/products/[id]/stock/page.tsx, components/ui/error-boundary.tsx.
- Dependientes: lib/schema.ts (índices), lib/actions/productVariants.ts (si bulk), app/api/admin/products/[id]/route.ts (fetch).
- No editar: lib/utils/logger.ts (ya robusto).

## Followup Steps
- [ ] Instalar deps si needed (ninguna nueva).
- [ ] Ejecutar servidor, probar en browser (login, /admin/products/[id]/stock, updates).
- [ ] Verificar BD: Logs insertados correctamente, transacciones atómicas.
- [ ] Actualizar AUDITORIA_REPORTE.md con resumen de fixes.

## Tareas Pendientes (Integrando Items Existentes)
### 1. Logging y Errores (Completado Inicial)
- [x] Logging detallado en ErrorBoundary.
- [x] Config logger para desarrollo.
- [x] Try-catch en handlers stock.

### 2. Validaciones Básicas (Completado Inicial)
- [x] Validar session.user.id.
- [x] Verificar usuario en BD.
- [x] Manejar sesión expirada.

### 3. Errores DB (Completado Inicial)
- [x] Validar IDs producto/variante.
- [x] Existencia antes update.
- [x] Errores conexión con mensajes.

### 4. Visualización Edit Page (Completado Inicial)
- [x] Stock read-only en variantes.
- [x] stockReadOnly en ProductVariants.

### 5. Testing Inicial
- [ ] Probar updates producto/variantes con user válido.
- [ ] Verificar logs con userId correcto.
- [ ] Confirmar no error genérico.

### 6. Mejoras Adicionales (Nuevas del Plan)
- [ ] Validación sesión/rol antes mods.
- [ ] Manejo errores sesión expirada.
- [ ] Confirmación update con warning.
- [ ] Rollback en errores (via transacciones).
