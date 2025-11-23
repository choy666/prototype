# Plan de Migración a Mercado Envíos 2 (ME2)

## Resumen Ejecutivo

Este documento describe el plan de migración completa del sistema de envíos actual a **Mercado Envíos 2 (ME2)**, eliminando la lógica local de cálculo de envíos y utilizando exclusivamente la API de Mercado Libre para la gestión logística.

## Estado Actual del Sistema

### Componentes Existentes
1. **Sistema de cálculo local** (`lib/utils/shipping.ts`, `lib/utils/shipping-calculator.ts`)
   - Cálculo basado en provincias con multiplicadores fijos
   - Configuración manual de costos y umbrales de envío gratis
   - Lógica de peso y dimensiones básica

2. **Integración parcial con Mercado Libre** (`lib/actions/shipments.ts`)
   - API para cálculo de costos mediante `calculateMLShippingCost`
   - Creación de shipments con modo `me2`
   - Tracking y sincronización de estados

3. **Checkout Pro configurado** (`app/api/checkout/route.ts`)
   - Ya utiliza `mode: "me2"` en objeto shipments
   - Estructura compatible con ME2

4. **Base de datos preparada** (`drizzle/0002_ml_shipping_modes.sql`)
   - Tabla `ml_shipping_modes` con modos ME1, ME2, ME3
   - Columnas en `orders` para integración ML
   - Tabla `shipment_history` para tracking

## Análisis de Modos de Envío

### Mercado Envíos 2 (ME2) - Modalidad Principal
**Descripción**: Logística completa gestionada por Mercado Libre utilizando diversos medios (correos, agencias, etc.)

**Tipos de logística ME2 disponibles**:
- **Standard**: Entrega estándar en 3-5 días hábiles
- **Express**: Entrega rápida en 1-2 días hábiles  
- **Fulfillment**: Almacenaje y despacho desde centros ML
- **Cross-docking**: Transferencia rápida entre centros
- **Drop-off**: Retiro en puntos habilitados

### Modos a Deprecar
- **ME1 (Mercado Envíos 1)**: Retiro en correo obsoleto
- **Custom**: Configuración personalizada (lógica local)
- **Cálculo local**: Multiplicadores por provincia hardcoded

## Plan de Migración

### Fase 0: Auditoría y Preparación de Datos (Semana 1 - CRÍTICA)

#### 0.1 Auditoría de Datos de Productos
- [ ] **Verificar dimensiones en tabla products**: height, width, length
- [ ] **Identificar productos sin dimensiones válidas**
- [ ] **Crear script de migración** para actualizar productos faltantes
- [ ] **Establecer dimensiones por defecto** para productos sin datos

```sql
-- Consulta para identificar productos problemáticos
SELECT id, name, weight, height, width, length 
FROM products 
WHERE height IS NULL OR width IS NULL OR length IS NULL 
OR height = 0 OR width = 0 OR length = 0;
```

#### 0.2 Estrategia de Pruebas y Validación
- [ ] **Configurar entorno sandbox** de Mercado Libre
- [ ] **Crear suite de pruebas comparativas** (cálculo local vs API ML)
- [ ] **Testear con 100 productos reales** diferentes dimensiones
- [ ] **Validar cobertura geográfica** para todos los códigos postales
- [ ] **Pruebas de estrés** con múltiples items en carrito

#### 0.4 Monitoreo y Observabilidad (CRÍTICO)
- [ ] **Implementar APM** para llamadas a API ME2
- [ ] **Configurar dashboards** de métricas: tiempo respuesta, tasa error, llamadas/minuto
- [ ] **Establecer alertas automáticas** para:
  - Tiempo de respuesta > 2 segundos
  - Tasa de error > 5%
  - API no disponible > 30 segundos
- [ ] **Implementar Circuit Breaker** para fallback automático
- [ ] **Configurar rate limiting** para respetar cuotas de API ML

#### 0.5 Estrategia de Caché
- [ ] **Implementar Redis** para caché de cálculos de envío
- [ ] **TTL de 1 hora** para resultados por zipcode + items
- [ ] **Invalidación automática** al cambiar precios/productos
- [ ] **Estimado de reducción**: 60-70% menos llamadas a API

#### 0.6 Configuración de Credenciales
- [ ] Verificar que las credenciales de Mercado Libre tengan permisos ME2
- [ ] Configurar webhooks para notificaciones de envíos
- [ ] Actualizar variables de entorno si es necesario

#### 0.7 Actualización de Base de Datos
- [ ] Ejecutar migración pendiente si no está aplicada
- [ ] Verificar índices de rendimiento para consultas ML
- [ ] Limpiar datos de prueba si existen

### Fase 1: Migración de Cálculo de Envíos (Semana 2)

#### 2.1 Reemplazar lógica de cálculo
**Archivo**: `app/api/checkout/route.ts`

```typescript
// REMOVER (líneas 149-150)
const totalWeight = calculateTotalWeight(items);
const shippingCost = calculateShippingCost(shippingMethod, totalWeight, shippingAddress.provincia, subtotal);

// REEMPLAZAR POR
const shippingCost = await calculateMLShippingCost(
  shippingAddress.codigoPostal,
  items.map(item => ({
    id: item.id.toString(),
    quantity: item.quantity,
    price: item.price
  }))
);
```

#### 2.2 Actualizar API de cálculo
**Archivo**: `app/api/shipments/calculate/route.ts`
- [ ] Mejorar manejo de errores y fallback
- [ ] Agregar caché de resultados por 1 hora
- [ ] Implementar reintentos automáticos

#### 2.3 Corregir manejo de dimensiones
**Problema**: Checkout usa `totalWeight` como string de dimensiones
**Solución**: Implementar cálculo real de dimensiones por producto

```typescript
// En shipments.ts - mejorar cálculo de dimensiones
const dimensions = {
  height: Number(product.height) || 10,
  width: Number(product.width) || 10, 
  length: Number(product.length) || 10,
  weight: Number(product.weight) || 0.5
};
```

### Fase 3: Deprecación de Componentes Obsoletos (Semana 3)

#### 3.1 Archivos a Eliminar
- `lib/utils/shipping.ts` ❌ **OBSOLETO**
- `lib/utils/shipping-calculator.ts` ❌ **OBSOLETO**

#### 3.2 Componentes a Actualizar
- `components/checkout/ShippingMethodSelector.tsx` - Usar API ML
- `components/checkout/ShippingForm.tsx` - Validar códigos postales ML
- `lib/validations/checkout.ts` - Actualizar validaciones

#### 3.3 Mantener como Fallback
- Lógica de fallback en `calculate/route.ts` (líneas 92-156) por 30 días

### Fase 4: Integración Completa (Semana 4)

#### 4.1 Webhooks de Envíos
**Archivo**: `app/api/mercadolibre/webhooks/shipments/route.ts`
- [ ] Procesar notificaciones de cambios de estado
- [ ] Actualizar `shipment_history` automáticamente
- [ ] Enviar notificaciones a clientes

#### 4.2 Dashboard de Administración
- [ ] Vista de shipments con tracking en tiempo real
- [ ] Impresión de etiquetas de envío
- [ ] Gestión de devoluciones

#### 4.3 Experiencia del Cliente
- [ ] Tracking público para clientes
- [ ] Notificaciones por email/SMS
- [ ] Calculadora de envíos mejorada

## Compatibilidad con Checkout Pro

### Verificación ✅
El Checkout Pro ya está configurado correctamente:
- `mode: "me2"` en objeto shipments
- Estructura de dirección compatible
- Metadata para sincronización

### Mejoras Requeridas
1. **Validación de cobertura**: Verificar que el código postal tenga cobertura ME2
2. **Cálculo en tiempo real**: Actualizar costos al cambiar dirección
3. **Manejo de múltiples items**: Soporte para cálculo por carrito completo

## Riesgos y Mitigación

### Riesgo Crítico
**Falla de API de Mercado Libre**
- **Mitigación**: Mantener fallback local por 30 días
- **Plan B**: Implementar cola de reintentos

### Riesgo Medio
**Incompatibilidad de dimensiones**
- **Mitigación**: Validar productos antes de migración
- **Plan B**: Usar dimensiones estándar como fallback

### Riesgo Bajo
**Cambios en la API ML**
- **Mitigación**: Versionar endpoints y respuestas
- **Plan B**: Implementar adaptador de API

## Timeline Detallado

| Semana | Actividades | Entregables |
|--------|-------------|-------------|
| 1 | Preparación y configuración | Credenciales verificadas, BD actualizada |
| 2 | Migración de cálculo | Checkout usando API ML |
| 3 | Deprecación de componentes | Código limpio, fallback activo |
| 4 | Integración completa | Webhooks activos, dashboard funcional |

## Métricas de Éxito

### Técnicas
- [ ] 100% de cálculos de envío via API ML
- [ ] < 500ms tiempo de respuesta promedio
- [ ] 99.9% uptime del servicio

### Negocio
- [ ] Reducción del 30% en costos de envío
- [ ] Mejora del 20% en tiempos de entrega
- [ ] 0% de quejas por cálculo incorrecto

## Rollback Plan

### Si falla la migración:
1. **Revertir checkout** a usar `calculateShippingCost` local
2. **Activar fallback** en todas las APIs
3. **Notificar** a equipos de soporte
4. **Investigar** causa raíz antes de reintentar

### Comandos de Rollback
```bash
# Revertir cambios en checkout
git checkout HEAD~1 -- app/api/checkout/route.ts

# Restaurar utilidades locales  
git checkout HEAD~1 -- lib/utils/shipping.ts
```

## Documentación de Referencia

- [API de Mercado Envíos - ML](https://developers.mercadolibre.com.ar/es_ar/mercado-envios)
- [Checkout Pro - MP](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/integration-configuration)
- [Webhooks de Envíos - ML](https://developers.mercadolibre.com.ar/es_ar/webhooks-de-envios)

## Próximos Pasos

1. **Aprobación** del plan por stakeholders
2. **Asignación** de recursos de desarrollo
3. **Programación** de ventanas de mantenimiento
4. **Comunicación** a equipos de soporte

---

**Estado**: Pendiente de Aprobación  
**Responsable**: Equipo de Desarrollo  
**Fecha estimada de inicio**: [Por definir]
