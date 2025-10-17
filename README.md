# Mi Tienda - E-commerce

Una plataforma de comercio electrónico completa construida con tecnologías modernas para ofrecer una experiencia de compra fluida y segura.

## 🚀 Características

- **Catálogo de Productos**: Navegación intuitiva con filtros, búsqueda y categorización
- **Carrito de Compras**: Gestión de productos con persistencia local y estado global
- **Sistema de Autenticación**: Registro/login tradicional y OAuth con Mercado Libre
- **Procesamiento de Pagos**: Integración completa con Mercado Pago
- **Panel de Usuario**: Gestión de perfil, direcciones y historial de pedidos
- **Diseño Responsive**: Optimizado para dispositivos móviles y desktop
- **Tema Oscuro/Claro**: Soporte para cambio de tema
- **Base de Datos**: PostgreSQL con Drizzle ORM y Neon

## 🛠️ Tecnologías Utilizadas

### Frontend
- **Next.js 15** - Framework React con App Router
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Framework de estilos utilitarios
- **Framer Motion** - Animaciones
- **React Hook Form** - Gestión de formularios
- **Zustand** - Gestión de estado global
- **React Query** - Gestión de estado del servidor

### Backend
- **Next.js API Routes** - API REST
- **NextAuth.js** - Autenticación
- **Drizzle ORM** - ORM para PostgreSQL
- **Neon** - Base de datos PostgreSQL serverless

### Integraciones
- **Mercado Pago** - Procesamiento de pagos
- **Mercado Libre OAuth** - Autenticación social

### Herramientas de Desarrollo
- **ESLint** - Linting de código
- **Prettier** - Formateo de código
- **Drizzle Kit** - Migraciones de base de datos
- **Jest** - Testing

## 📋 Prerrequisitos

- Node.js 18+
- PostgreSQL (Neon recomendado)
- Cuenta de Mercado Pago
- Cuenta de Mercado Libre (para OAuth)

## 🚀 Instalación

1. **Clona el repositorio**
   ```bash
   git clone <url-del-repositorio>
   cd mi-tienda
   ```

2. **Instala las dependencias**
   ```bash
   npm install
   ```

3. **Configura las variables de entorno**

   Crea un archivo `.env.local` en la raíz del proyecto:

   ```env
   # Base de datos
   DATABASE_URL="postgresql://user:password@host:port/database"

   # NextAuth.js
   NEXTAUTH_SECRET="tu-secreto-aqui"
   NEXTAUTH_URL="http://localhost:3000"

   # Mercado Libre OAuth
   MERCADO_LIBRE_CLIENT_ID="tu-client-id"
   MERCADO_LIBRE_CLIENT_SECRET="tu-client-secret"

   # Mercado Pago
   MERCADO_PAGO_ACCESS_TOKEN="tu-access-token"
   MERCADO_PAGO_PUBLIC_KEY="tu-public-key"

   # Otras configuraciones
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

4. **Configura la base de datos**

   ```bash
   # Genera las migraciones
   npm run db:generate

   # Aplica las migraciones
   npm run db:push

   # Opcional: Abre Drizzle Studio
   npm run db:studio
   ```

5. **Inicia el servidor de desarrollo**
   ```bash
   npm run dev
   ```

   La aplicación estará disponible en `http://localhost:3000`

## 📁 Estructura del Proyecto

```
mi-tienda/
├── app/                    # Páginas y rutas de Next.js
│   ├── (auth)/            # Rutas de autenticación
│   ├── (protected)/       # Rutas protegidas
│   ├── api/               # API routes
│   ├── cart/              # Página del carrito
│   ├── checkout/          # Página de checkout
│   ├── products/          # Páginas de productos
│   └── ...
├── components/            # Componentes React
│   ├── ui/               # Componentes de UI reutilizables
│   ├── cart/             # Componentes del carrito
│   ├── products/         # Componentes de productos
│   └── ...
├── lib/                  # Utilidades y configuraciones
│   ├── actions/          # Server actions
│   ├── auth/             # Configuración de autenticación
│   ├── db.ts             # Conexión a base de datos
│   ├── mercadopago/      # Integración Mercado Pago
│   ├── schema.ts         # Esquemas de base de datos
│   ├── stores/           # Stores de Zustand
│   ├── utils/            # Utilidades
│   └── validations/      # Validaciones con Zod
├── types/                # Tipos TypeScript
├── hooks/                # Custom hooks
├── scripts/              # Scripts de utilidad
├── ayuda/                # Documentación
└── ...
```

## 🗄️ Base de Datos

El proyecto utiliza Drizzle ORM con PostgreSQL. Los esquemas principales incluyen:

- **users**: Usuarios con soporte para autenticación tradicional y OAuth
- **products**: Catálogo de productos con categorías y descuentos
- **carts**: Carritos de compras
- **cart_items**: Ítems del carrito
- **orders**: Órdenes de compra
- **order_items**: Ítems de las órdenes

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Inicia servidor de desarrollo
npm run build            # Construye la aplicación
npm run start            # Inicia servidor de producción
npm run lint             # Ejecuta ESLint
npm run lint:fix         # Corrige errores de ESLint
npm run typecheck        # Verifica tipos TypeScript
npm run dev:tunnel       # Inicia servidores de desarrollo en port 3000 y en dominio fijo con tunnel 

# Base de datos
npm run db:generate      # Genera migraciones
npm run db:push          # Aplica migraciones
npm run db:studio        # Abre Drizzle Studio
npm run db:backup        # Crea backup de BD
npm run db:restore       # Restaura backup de BD

# Testing
npm run test             # Ejecuta tests
node security-tests.js
node csrf-tests.js
```

## 🌐 Despliegue

### Vercel (Recomendado)

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno en Vercel
3. Despliega automáticamente

### Otros Proveedores

Asegúrate de configurar las variables de entorno y la base de datos en tu proveedor de hosting.

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📞 Soporte

Si tienes preguntas o problemas, por favor abre un issue en el repositorio o contacta al equipo de desarrollo.

---

Desarrollado con ❤️ usando Next.js y TypeScript

---
vercel link → Vincular proyecto local.

vercel env pull .env.local → Sincronizar variables.

vercel dev → Correr local con el mismo entorno que producción.

vercel → Deploy.

vercel logs <url> → Debuggear errores en serverless.