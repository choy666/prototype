# Plan de Implementación Actualizado: Integración en Navbar Existente

Basado en la estructura actual del Navbar, aquí está el plan actualizado:

## 1. Actualización del Navbar para Incluir MercadoLibre

### 1.1 Agregar Ícono de MercadoLibre
- **Archivo**: [/components/ui/Navbar.tsx](cci:7://file:///c:/developer%20web/paginas/prototype/components/ui/Navbar.tsx:0:0-0:0)
- **Cambios**:
  - Importar el ícono de MercadoLibre
  - Agregar el ítem de navegación para administradores

### 1.2 Actualizar la Lista de Navegación
- Modificar el array `navItems` para incluir MercadoLibre

## 2. Implementación del Indicador de Estado

### 2.1 Crear Componente `MercadoLibreStatus`
- **Ubicación**: `/components/admin/MercadoLibreStatus.tsx`
- **Funcionalidad**:
  - Mostrar estado de conexión (conectado/desconectado)
  - Incluir indicador visual (icono de estado)

### 2.2 Integrar en el Dashboard
- **Ubicación**: `/app/admin/dashboard/page.tsx`
- **Cambios**:
  - Agregar tarjeta con el estado de MercadoLibre
  - Incluir enlace rápido a la configuración

## 3. Código de Implementación

### 3.1 Actualización de [Navbar.tsx](cci:7://file:///c:/developer%20web/paginas/prototype/components/ui/Navbar.tsx:0:0-0:0)

```tsx
// En la sección de imports, agregar:
import { ShoppingCart, Menu, X, House, User, LayoutDashboard, Package, ShoppingCart as ShoppingCartIcon, Users, BarChart3, Tag, ShoppingBag } from 'lucide-react';

// En el array de navItems para admin, agregar:
const navItems = isAdmin ? [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Productos', href: '/admin/products', icon: Package },
  { name: 'Categorías', href: '/admin/categories', icon: Tag },
  { name: 'MercadoLibre', href: '/admin/mercadolibre', icon: ShoppingBag },
  { name: 'Pedidos', href: '/admin/orders', icon: ShoppingCartIcon },
  { name: 'Usuarios', href: '/admin/users', icon: Users },
  { name: 'Reportes', href: '/admin/reports', icon: BarChart3 },
] : [
  // ... resto del código existente
];
```

### 3.2 Crear Componente `MercadoLibreStatus.tsx`

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertCircle, Loader2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

async function fetchMercadoLibreStatus() {
  const res = await fetch('/api/auth/mercadolibre/status');
  if (!res.ok) throw new Error('Error al obtener el estado');
  return res.json();
}

export function MercadoLibreStatus() {
  const { data, isLoading, error } = useQuery(
    ['mercadolibre-status'],
    fetchMercadoLibreStatus,
    { retry: false }
  );

  const isConnected = data?.connected;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <ShoppingBag className="mr-2 h-4 w-4" />
          Estado de MercadoLibre
        </CardTitle>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isConnected ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-yellow-500" />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isLoading
            ? 'Cargando...'
            : isConnected
            ? 'Conectado'
            : 'Desconectado'}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {isConnected
            ? `Usuario: ${data?.userId || 'N/A'}`
            : 'No conectado a MercadoLibre'}
        </p>
        <div className="mt-4">
          <Link href="/admin/mercadolibre">
            <Button variant="outline" size="sm" className="w-full">
              {isConnected ? 'Administrar' : 'Conectar'}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3.3 Actualizar Dashboard de Administración

En `/app/admin/dashboard/page.tsx`:

```tsx
import { MercadoLibreStatus } from '@/components/admin/MercadoLibreStatus';

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Panel de Administración</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MercadoLibreStatus />
        {/* Otras tarjetas del dashboard */}
      </div>
    </div>
  );
}
```

## 4. Pasos de Implementación

1. **Actualizar Navbar**:
   - Agregar el ícono de MercadoLibre a los imports
   - Añadir el ítem de navegación en el array `navItems` para administradores

2. **Crear componente de estado**:
   - Crear el archivo `MercadoLibreStatus.tsx` en [/components/admin/](cci:7://file:///c:/developer%20web/paginas/prototype/components/admin:0:0-0:0)

3. **Actualizar dashboard**:
   - Importar y agregar el componente `MercadoLibreStatus` al dashboard

4. **Probar la implementación**:
   - Verificar que el enlace de MercadoLibre aparezca en la barra de navegación para administradores
   - Comprobar que el estado de conexión se muestre correctamente en el dashboard

## 5. Beneficios de esta Implementación

1. **Integración consistente**: Se mantiene el estilo y comportamiento existente del Navbar
2. **Fácil mantenimiento**: Todo el código relacionado con MercadoLibre está en sus propios componentes
3. **Experiencia de usuario mejorada**: Acceso rápido a la configuración de MercadoLibre desde la navegación principal
4. **Retroalimentación visual**: Los administradores pueden ver el estado de la conexión directamente desde el dashboard