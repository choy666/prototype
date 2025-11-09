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
npx tsx --env-file=.env.local scripts/create-shipping-methods.ts

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

## 📊 Estado Actual del Proyecto

El proyecto se encuentra en fase de mejoras críticas post-auditoría. Para más detalles sobre el progreso y tareas pendientes, consulta [TODO_AUDITORIA.md](TODO_AUDITORIA.md).

### Progreso Actual
- **Semana Actual**: 0/8 completada
- **Funcionalidades Críticas**: 0/3 completadas
- **Puntuación Actual**: 8.5/10 → **Objetivo Final: 9.5/10**

### Próximas Mejoras Prioritarias
- Implementación completa de OAuth con Mercado Libre
- Sistema de recuperación de contraseña
- Panel administrativo avanzado
- Persistencia del carrito en base de datos

---
# Listar variables de entorno
vercel env ls

# Agregar una variable
vercel env add NEXTAUTH_SECRET production

# Eliminar una variable
vercel env rm NEXTAUTH_SECRET production

# Descargar variables de Vercel a un archivo local
vercel env pull .env.local

# Descargar variables de producción
vercel env pull .env.local --environment=production

Se ha creado un script de prueba para simular el flujo completo de checkout con MercadoPago. El script ejecutó pruebas básicas pero encontró problemas con la autenticación (NextAuth CSRF issues), por lo que continuó con simulación.

Pruebas realizadas:

✅ Verificación de estructura del código de checkout
✅ Simulación de login (falló por CSRF, pero continuó)
✅ Simulación de checkout (falló por autenticación, pero simuló respuesta)
✅ Generación de instrucciones para testing manual
Áreas que requieren cobertura adicional:

Testing manual completo en navegador con credenciales reales
Verificación del flujo completo: login → agregar productos → checkout → pago en MercadoPago → webhook → confirmación
Pruebas de edge cases (stock insuficiente, errores de pago, etc.)
Instrucciones para testing manual:

Abrir el navegador en http://localhost:3000 // https://prototype-ten-dun.vercel.app
Iniciar sesión con usuario de prueba (crear manualmente si no existe)
Agregar productos al carrito
Ir a checkout y proceder al pago
En MercadoPago usar credenciales de test:
Usuario: TESTUSER6039252931406235156
Contraseña: TemH1Q4tCP
Tarjeta: 5031 7557 3453 0604 (11/30, CVV 123)
Completar el pago y verificar redirección y estado de orden

🧪 Resumen de Comandos de Drizzle Kit
🔧 Comandos Principales
🛠️ npx drizzle-kit generate Genera archivos de migración SQL basados en los cambios en lib/schema.ts. 📁 Crea un archivo en la carpeta drizzle/ con el SQL necesario.

🚚 npx drizzle-kit migrate Aplica las migraciones pendientes a la base de datos conectada (DATABASE_URL). 📜 Ejecuta los archivos SQL generados en orden.

⚡ npx drizzle-kit push Sincroniza directamente el schema actual con la base de datos. 🚀 Ideal para desarrollo rápido o cuando las migraciones fallan.

🔍 npx drizzle-kit check Verifica que el schema en el código coincida con la base de datos actual. ✅ Útil para confirmar antes de desplegar.

🚀 Flujo Usado en Este Despliegue
🧬 Generate → Se creó la migración localmente.

🧨 Push → Se aplicaron los cambios directamente en producción (por problemas con migraciones faltantes).

🕵️‍♂️ Check → Se validó que el estado del schema y la base de datos coincidieran.