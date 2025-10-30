# 📋 TODO - Implementación Dashboard Admin (Post-Auditoría)

## 🎯 Estado Actual del Dashboard (Basado en Auditoría)

### ✅ **Funcionalidades Verificadas**
- Panel administrativo básico operativo
- Server Components con Drizzle ORM funcionando
- Consultas SQL correctas implementadas
- Servidor Next.js corriendo correctamente

### ❌ **Problemas Críticos Encontrados**

#### 🔥 **CRÍTICO - Error de Conexión BD**
- [ ] **Configurar DATABASE_URL**: Variable de entorno no definida
- [ ] **Verificar conexión a Neon/BD**: Asegurar que la BD esté accesible
- [ ] **Probar consultas reales**: Ejecutar script de auditoría después de configurar BD

#### 🔥 **ALTA PRIORIDAD - Datos Hardcodeados**
- [ ] **Calcular tendencias dinámicas**: Reemplazar valores hardcodeados (12%, 8%, 15%) con cálculos reales
- [ ] **Implementar cálculo usuarios**: `(total_actual - total_mes_pasado) / total_mes_pasado * 100`
- [ ] **Implementar cálculo productos**: `(total_actual - total_mes_pasado) / total_mes_pasado * 100`
- [ ] **Implementar cálculo pedidos**: `(total_actual - total_mes_pasado) / total_mes_pasado * 100`

#### 🟡 **MEDIA PRIORIDAD - Funcionalidades Faltantes**
- [ ] **Implementar actividad reciente**: Reemplazar placeholder con logging real de actividades
- [ ] **Agregar verificación BD en tiempo real**: Endpoint para verificar estado de conexión
- [ ] **Validar estado de pagos**: Verificar integración con MercadoPago
- [ ] **Sistema de notificaciones**: Alertas para stock bajo, pedidos nuevos

#### 🟢 **BAJA PRIORIDAD - Mejoras**
- [ ] **Script de auditoría automatizada**: Comando para verificar datos del dashboard
- [ ] **Manejo de errores**: Estados de error cuando BD no esté disponible
- [ ] **Caché de estadísticas**: Evitar consultas repetidas en corto tiempo
- [ ] **Dashboard personalizado**: Diferentes vistas según rol de admin

## 🚀 **Plan de Implementación Priorizado**

### **FASE 1: Configuración y Conexión (Día 1)**
1. [ ] Configurar `DATABASE_URL` en `.env.local`
2. [ ] Verificar conexión a base de datos
3. [ ] Ejecutar script de auditoría para validar datos reales
4. [ ] Corregir cualquier error de conexión

### **FASE 2: Cálculos Dinámicos (Día 2)**
1. [ ] Modificar `getStats()` en `app/admin/page.tsx`
2. [ ] Implementar consultas para calcular tendencias reales:
   ```typescript
   // Usuarios del último mes
   const [lastMonthUsers] = await db.select({ count: count() })
     .from(users)
     .where(gte(users.createdAt, lastMonth));

   // Calcular porcentaje
   const userTrend = lastMonthUsers.count > 0
     ? ((userCount.count - lastMonthUsers.count) / lastMonthUsers.count) * 100
     : 0;
   ```
3. [ ] Aplicar mismo patrón para productos y pedidos
4. [ ] Verificar que ingresos ya calculan dinámicamente

### **FASE 3: Verificación de Estado del Sistema (Día 3)**
1. [ ] Crear endpoint `/api/admin/system-status/route.ts`
2. [ ] Implementar verificación de conexión BD
3. [ ] Agregar verificación de estado de pagos
4. [ ] Actualizar dashboard para mostrar estado real

### **FASE 4: Actividad Reciente (Día 4)**
1. [ ] Crear tabla `activity_logs` en schema
2. [ ] Implementar logging automático en operaciones CRUD
3. [ ] Crear componente para mostrar últimas actividades
4. [ ] Agregar filtros por tipo de actividad

### **FASE 5: Testing y Optimización (Día 5)**
1. [ ] Ejecutar auditoría completa con datos reales
2. [ ] Verificar responsive design en móvil/tablet
3. [ ] Optimizar consultas con índices si es necesario
4. [ ] Implementar caché para estadísticas

## 🧪 **Testing Obligatorio**

### **Después de FASE 1**
- [ ] Verificar que `npm run dev` funciona sin errores
- [ ] Confirmar conexión a BD exitosa
- [ ] Ejecutar script de auditoría y validar números

### **Después de FASE 2**
- [ ] Verificar que tendencias cambian según datos reales
- [ ] Probar con datos de prueba para validar cálculos
- [ ] Confirmar que ingresos muestran valores correctos

### **Después de FASE 3**
- [ ] Verificar indicadores de estado del sistema
- [ ] Probar desconexión de BD y ver manejo de errores
- [ ] Validar estado de pagos

## 📊 **Métricas de Validación**

### **Datos Esperados (Después de Implementación)**
- Total Usuarios: Número real de la BD
- Total Productos: Número real de la BD
- Total Pedidos: Número real de la BD
- Ingresos Totales: Suma real de pedidos pagados
- Tendencias: Cálculos basados en datos históricos reales

### **Estados del Sistema**
- Base de Datos: "Conectada" (verde) / "Error de conexión" (rojo)
- Servidor: "Operativo" (verde)
- Pagos: "Activo" (verde) / "Inactivo" (rojo)

## 🔧 **Archivos a Modificar**

### **Configuración**
- `.env.local` - Agregar DATABASE_URL

### **Dashboard Principal**
- `app/admin/page.tsx` - Modificar getStats() para cálculos dinámicos

### **Nuevos Endpoints**
- `app/api/admin/system-status/route.ts` - Verificación de estado
- `app/api/admin/activity/route.ts` - Actividad reciente

### **Schema**
- `lib/schema.ts` - Agregar tabla activity_logs si es necesario

### **Scripts**
- `scripts/audit-dashboard.ts` - Ya creado, usar para validación

## 📝 **Notas Técnicas**

### **Consideraciones de Seguridad**
- Mantener validación de roles de admin
- Loggear todas las operaciones administrativas
- Implementar rate limiting en endpoints nuevos

### **Rendimiento**
- Evitar consultas N+1 en cálculos de tendencias
- Implementar caché para estadísticas (Redis opcional)
- Optimizar consultas con índices apropiados

### **Mantenibilidad**
- Documentar nuevas funciones en README
- Agregar tipos TypeScript apropiados
- Mantener consistencia con código existente

---

**📅 Fecha**: 28/10/2025
**👤 Responsable**: BLACKBOXAI
**📊 Estado**: Listo para implementación
**⏱️ Tiempo Estimado**: 5 días
