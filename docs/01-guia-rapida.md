# Guía Rápida del Proyecto

## 🚀 Overview

Proyecto de e-commerce completo con Next.js 15.5, TypeScript, Tailwind CSS, Drizzle ORM y Neon Postgres. Incluye integraciones con Mercado Pago, Mercado Envíos 2.0, Mercado Libre y Tiendanube/Nuvemshop.

## 📋 Estado General

### ✅ Funcionalidades Implementadas

- **Autenticación**: NextAuth v5 con OAuth Mercado Libre
- **Catálogo**: CRUD de productos con categorías y variantes
- **Carrito**: Estado global con Zustand y persistencia local
- **Checkout**: Flujo completo con dirección y pagos
- **Pagos**: Integración Mercado Pago con webhooks
- **Envíos**: Mercado Envíos 2.0 con cálculo en tiempo real
- **Panel Admin**: Dashboard con métricas y gestión
- **Mercado Libre**: Sincronización de productos y órdenes
- **Tiendanube**: Integración completa con OAuth y webhooks

### ⚙️ Configuración Inicial

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# 3. Migrar base de datos
npm run db:push

# 4. Iniciar desarrollo
npm run dev
```

## 🔧 Variables de Entorno Esenciales

```bash
# Base de datos
DATABASE_URL=postgresql://...

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=...
MERCADOPAGO_PUBLIC_KEY=...

# Mercado Libre
ML_APP_ID=...
ML_CLIENT_SECRET=...

# Tiendanube
TIENDANUBE_APP_ID=...
TIENDANUBE_CLIENT_SECRET=...
INTEGRATION_TOKEN_ENCRYPTION_KEY=... (32 chars)
```

## 📁 Estructura del Proyecto

```
├── app/                    # Páginas y API routes
│   ├── (auth)/            # Rutas de autenticación
│   ├── (protected)/       # Rutas protegidas
│   ├── admin/             # Panel administrativo
│   └── api/               # Endpoints API
├── components/            # Componentes React
│   ├── admin/            # Componentes admin
│   ├── cart/             # Carrito de compras
│   └── checkout/         # Flujo de checkout
├── lib/                   # Utilidades y configuración
│   ├── actions/          # Server actions
│   ├── clients/          # Clientes de APIs
│   └── schema.ts         # Esquema de base de datos
├── docs/                  # Documentación
└── tests/                 # Tests unitarios, integración y E2E
```

## 🛒 Flujo de Venta

1. **Cliente navega** el catálogo de productos
2. **Agrega productos** al carrito (persistencia local)
3. **Inicia checkout**:
   - Selecciona dirección o crea nueva
   - Calcula envíos con ME2
   - Elige método de pago
4. **Paga con Mercado Pago**: Redirección y retorno
5. **Confirmación**: Orden creada y stock actualizado

## 📦 Gestión de Productos

### Crear Producto

1. Ir a `/admin/products`
2. Completar datos básicos (nombre, descripción, precio)
3. Configurar categorías interna y Mercado Libre
4. Agregar atributos específicos de la categoría ML
5. Definir stock y variantes si aplica
6. Guardar y sincronizar con Mercado Libre

### Sincronización

- **Local → ML**: Productos, stock y precios
- **ML → Local**: Órdenes y clientes
- **Tiendanube**: Similar flujo bidireccional

## 🎯 Roles de Usuario

### Cliente

- Registro y login tradicional
- Compras y seguimiento de pedidos
- Gestión de direcciones

### Administrador

- Dashboard con métricas en tiempo real
- Gestión completa de productos
- Configuración de integraciones
- Reportes y estadísticas

## 🔍 Monitoreo y Logs

Prefijos para buscar en logs:

- `[Tiendanube]` - Eventos de integración
- `[ML]` - Eventos de Mercado Libre
- `[ME2]` - Cálculo de envíos
- `[MP]` - Pagos Mercado Pago

## 🧪 Testing

```bash
# Tests unitarios
npm run test:unit

# Tests de integración
npm run test:integration

# Tests E2E (requiere servidor)
npm run test:e2e

# Cobertura
npm run test:coverage
```

## 🚀 Deploy en Producción

### Vercel (Recomendado)

```bash
# Instalar CLI
npm i -g vercel

# Deploy
vercel --prod

# Configurar variables de entorno
vercel env add NOMBRE_VAR production
```

### Verificaciones Post-Deploy

- OAuth funcionando con ML y Tiendanube
- Webhooks recibiendo eventos
- Pagos procesándose correctamente
- Envíos calculando sin errores

## 📞 Soporte y Troubleshooting

### Issues Comunes

1. **Pagos fallidos**: Verificar tokens de MP
2. **Envíos no calculan**: Revisar configuración ME2
3. **Sync no funciona**: Validar tokens y permisos
4. **Webhooks no llegan**: Confirmar URLs públicas

### Contacto

- **Documentación técnica**: Ver archivos específicos de integración
- **Logs**: Siempre incluir timestamp y contexto
- **Issues**: Usar plantilla con capturas y datos de entorno

## 🔄 Próximos Pasos

1. **Optimización**: Service workers y analytics
2. **Testing**: Suite completa de E2E
3. **Multi-store**: Soporte para múltiples tiendas
4. **API Pública**: Endpoints para terceros

---

_Para detalles específicos de cada integración, consultar los documentos dedicados:_

- `02-integracion-tiendanube.md`
- `03-integracion-mercadolibre.md`
- `04-guia-administracion.md`
- `05-testing-produccion.md`
