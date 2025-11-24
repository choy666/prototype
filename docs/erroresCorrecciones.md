# Plan de Corrección de Errores - Build Next.js

## 📊 Estado Actual del Build

**Resultado**: ❌ **Build Failed** con errores críticos y advertencias

**Impacto**: Bloquea despliegue a producción y genera inconsistencias en filesystems case-sensitive

---

## 🚨 Priorización de Errores

### **Nivel 1: Críticos (Bloquean Build)**
- ✅ `any` types en lugar de tipos específicos (7 archivos)
- ✅ `require()` imports prohibidos (7 archivos API)
- ✅ Missing dependencies en React hooks

### **Nivel 2: Advertencias (Compila con Warnings)**
- ⚠️ Conflictos de casing en componentes UI (3 componentes)
- ⚠️ Variables/imports no utilizados (12 archivos)

---

## 🎯 Plan de Implementación

### **FASE 1: Corrección de Errores Críticos (Prioridad Alta)**

#### **1.1 Crear Tipos Específicos para APIs de Mercado Libre**

**Archivos a modificar**:
```typescript
// Crear: lib/types/mercado-libre.ts
interface MercadoLibreShipment {
  id: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  tracking_number?: string;
  tracking_url?: string;
  date_created: string;
  // ... otros campos según documentación oficial
}

interface MercadoPagoPayment {
  id: string;
  status: 'approved' | 'pending' | 'rejected';
  payment_method_id: string;
  // ... otros campos según API docs
}
```

**Correcciones aplicadas**:
- `app/api/checkout/route.ts` (líneas 178-179)
- `app/admin/shipments/[id]/page.tsx` (línea 37)
- `app/api/migration/status/route.ts` (líneas 37, 70)
- `lib/actions/me2-shipping.ts` (líneas 32-33, 208)

#### **1.2 Reemplazar require() por Dynamic Imports**

**Archivos afectados**:
```typescript
// Antes (prohibido):
const fs = require('fs');
const path = require('path');

// Después (permitido):
import fs from 'fs';
import path from 'path';

// Para imports condicionales:
const module = await import('some-module');
```

**Correcciones**:
- `app/api/migration/audit/route.ts` (líneas 129-130)
- `app/api/migration/check-credentials/route.ts` (líneas 124-125)
- `app/api/migration/fix-products/route.ts` (líneas 276-277)
- `app/api/migration/monitoring/route.ts` (líneas 142-143)
- `app/api/migration/rollback/route.ts` (líneas 226-227)
- `app/api/migration/setup-cache/route.ts` (líneas 90-91)
- `app/api/migration/testing-strategy/route.ts` (líneas 142-143)

#### **1.3 Corregir React Hooks Dependencies**

**Archivo**: `app/admin/shipments/[id]/page.tsx`
```typescript
// Corrección línea 79:
const loadShipmentDetail = useCallback(async () => {
  // ... existing code
}, [shipmentId]);

useEffect(() => {
  if (shipmentId) {
    loadShipmentDetail();
  }
}, [shipmentId, loadShipmentDetail]); // Agregar dependency
```

---

### **FASE 2: Limpieza de Código (Prioridad Media)**

#### **2.1 Remover Imports/Variables No Utilizadas**

**Archivos y líneas específicas**:
- `app/admin/shipments/page.tsx` - Remover `Filter` import (línea 9)
- `app/admin/shipments/[id]/page.tsx` - Remover `Edit` import (línea 16)
- `app/api/admin/audit-products/route.ts` - Remover parámetro `request` (línea 5)
- `app/api/admin/health/route.ts` - Remover `HealthResponse` type (línea 6)
- Y otros 8 archivos con patrones similares

#### **2.2 Estandarizar Naming Convention de Componentes UI**

**Estrategia**: Estandarizar a **lowercase** para consistencia con el resto del proyecto

**Cambios requeridos**:
```bash
# Renombrar archivos (si no existen):
components/ui/Badge.tsx → components/ui/badge.tsx
components/ui/Card.tsx → components/ui/card.tsx  
components/ui/Select.tsx → components/ui/select.tsx

# Actualizar imports en archivos afectados:
app/admin/shipments/page.tsx
app/admin/shipments/[id]/page.tsx
```

**Imports corregidos**:
```typescript
// De:
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';

// A:
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
```

---

### **FASE 3: Optimización y Mejores Prácticas**

#### **3.1 Tipado Fuerte para Integraciones**

**Crear tipos específicos según documentación oficial**:
```typescript
// lib/types/mercado-envios.ts
export interface ME2ShippingRequest {
  dimensions: {
    height: number;
    width: number;
    length: number;
    weight: number;
  };
  destination: {
    postal_code: string;
    country_id: string;
  };
  items: Array<{
    id: string;
    quantity: number;
    dimensions?: ME2Dimensions;
  }>;
}

// lib/types/api-responses.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
```

#### **3.2 Configuración ESLint para Desarrollo**

**Actualizar .eslintrc.json**:
```json
{
  "extends": ["next/core-web-vitals"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-require-imports": "error",
    "@typescript-eslint/no-unused-vars": "warn",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

---

## 📋 Checklist de Verificación

### **Antes del Build**
- [ ] Todos los `any` types reemplazados con interfaces específicas
- [ ] Todos los `require()` convertidos a ES6 imports
- [ ] Dependencies de React hooks completas
- [ ] Imports no utilizados removidos
- [ ] Componentes UI con naming consistente

### **Validación Post-Corrección**
```bash
# 1. Verificar TypeScript
npm run type-check

# 2. Verificar ESLint
npm run lint

# 3. Build de producción
npm run build

# 4. Verificar que no haya warnings
npm run lint -- --max-warnings 0
```

---

## ⚡ Comandos de Corrección Rápida

### **Para conflicto de componentes UI**:
```bash
# Opción 1: Renombrar archivos a lowercase
mv components/ui/Badge.tsx components/ui/badge.tsx
mv components/ui/Card.tsx components/ui/card.tsx
mv components/ui/Select.tsx components/ui/select.tsx

# Opción 2: Actualizar imports a mayúsculas (si prefieres mantener archivos)
find . -name "*.tsx" -exec sed -i 's/@\/components\/ui\/badge/@\/components\/ui\/Badge/g' {} \;
find . -name "*.tsx" -exec sed -i 's/@\/components\/ui\/card/@\/components\/ui\/Card/g' {} \;
find . -name "*.tsx" -exec sed -i 's/@\/components\/ui\/select/@\/components\/ui\/Select/g' {} \;
```

### **Para limpieza de imports no utilizados**:
```bash
# Usar ESLint auto-fix
npm run lint -- --fix
```

---

## 🚀 Impacto Esperado

### **Resultado Final**
- ✅ **Build exitoso sin errores**
- ✅ **Zero warnings** en producción
- ✅ **Tipado fuerte** para todas las integraciones
- ✅ **Consistencia** en naming convention
- ✅ **Compatibilidad** con filesystems case-sensitive

### **Beneficios**
- **Despliegue estable** a producción (Vercel, AWS, etc.)
- **Mejor DX** con autocompletado y detección de errores
- **Mantenibilidad** a largo plazo del código
- **Integraciones robustas** con Mercado Libre/Pago

---

## 📚 Referencias Oficiales

### **Mercado Libre API Docs**
- [Shipping API](https://developers.mercadolibre.com.ar/es_ar/envios-y-fulfillment)
- [Payments API](https://www.mercadopago.com.ar/developers/es/docs)
- [Webhooks Documentation](https://developers.mercadolibre.com.ar/es_ar/webhooks-notificaciones)

### **Next.js Best Practices**
- [TypeScript Configuration](https://nextjs.org/docs/basic-features/typescript)
- [ESLint Configuration](https://nextjs.org/docs/basic-features/eslint)
- [Build Optimization](https://nextjs.org/docs/advanced-features/optimizing)

---

## 🔄 Timeline Estimado

**Fase 1 (Críticos)**: 2-3 horas
**Fase 2 (Limpieza)**: 1-2 horas  
**Fase 3 (Optimización)**: 1 hora

**Total**: 4-6 horas para build completamente limpio

---

*Este documento debe ser actualizado conforme se avance en las correcciones para mantener registro de los cambios realizados.*
