# Neon Postgres

A minimal template for building full-stack React applications using Next.js, Vercel, and Neon.

## Local Setup

### Installation

Install the dependencies:

```bash
npm install
```

You can use the package manager of your choice. For example, Vercel also supports `bun install` out of the box.

### Development

#### Create a .env file in the project root

```bash
cp .env.example .env
```

#### Get your database URL

Obtain the database connection string from the Connection Details widget on the [Neon Dashboard](https://console.neon.tech/).

#### Add the database URL to the .env file

Update the `.env` file with your database connection string:

```txt
# The connection string has the format `postgres://user:pass@host/db`
DATABASE_URL=<your-string-here>
```

#### Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Neon, check out the Neon documentation:

- [Neon Documentation](https://neon.tech/docs/introduction) - learn about Neon's features and SDKs.
- [Neon Discord](https://discord.gg/9kf3G4yUZk) - join the Neon Discord server to ask questions and join the community.
- [ORM Integrations](https://neon.tech/docs/get-started-with-neon/orms) - find Object-Relational Mappers (ORMs) that work with Neon.

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy on Vercel

Commit and push your code changes to your GitHub repository to automatically trigger a new deployment.

**\*\*\*\***\_**\*\*\*\*** resumen de cmds
pedir todas las dependiencias del proyecto mas facil
npm install
npm run dev
"framer-motion": "^12.23.15",
"lucide-react": "^0.544.0",
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
npm install google-auth-library
npm install clsx tailwind-merge
npm install -D @types/react
npm install bcryptjs
npm install --save-dev @types/bcryptjs
npm install mercadopago
# 1. Haces cambios en lib/schema.ts
npx drizzle-kit generate --config=drizzle.config.ts
npx drizzle-kit push --config=drizzle.config.ts.ts

# Autenticación

npm install next-auth @auth/core

# Validación

npm install zod

# Testing (opcional)

npm install -D jest @testing-library/react @testing-library/jest-dom

# Tipos

npm install -D @types/node @types/react @types/react-dom
npm install -D eslint eslint-config-prettier eslint-plugin-prettier eslint-config-next @typescript-eslint/parser @typescript-eslint/eslint-plugin

---

promt:
Respuesta formada por la ia cascade:
[CONTEXTO DEL PROYECTO]
Estamos trabajando en un proyecto e-commerce con Next.js (App Router), TypeScript y arquitectura modular.  
La estructura objetivo del proyecto es:

app/
(auth)/login/page.tsx
(auth)/register/page.tsx
(auth)/mercadolibre/page.tsx
(auth)/layout.tsx
(shop)/products/page.tsx
(shop)/products/[id]/page.tsx
(shop)/cart/page.tsx
(shop)/checkout/page.tsx
(shop)/layout.tsx
(dashboard)/...
api/
auth/...
products/...
cart/...
checkout/...
orders/...
lib/
db.ts, schema.ts, mercadopago.ts, mercadolibre.ts, actions/\*
components/
products/, cart/, checkout/, ui/
services/
payment.ts, email.ts, mercadolibre-api.ts
types/
product.ts, order.ts, cart.ts, user.ts
hooks/
useCart.ts, useAuth.ts, useMercadoLibreAuth.ts

[ESTÁNDARES Y BUENAS PRÁCTICAS]

- **Lenguaje:** TypeScript + React Server Components (Next.js 13+ App Router).
- **Estilo:** ESLint + Prettier, convenciones de nombres en camelCase para funciones/variables, PascalCase para componentes, kebab-case para rutas.
- **Arquitectura:** Mantener separación clara entre UI (components), lógica de negocio (lib/actions, services), y datos (lib/db, lib/schema).
- **API Routes:** Usar handlers async/await, validación de entrada (Zod o similar), manejo de errores consistente.
- **Integraciones:** Mercado Libre (OAuth + API) y Mercado Pago (pagos) encapsuladas en lib/ y services/.
- **Testing:** Unit tests para lógica de negocio, integración para endpoints críticos.
- **Seguridad:** Sanitizar inputs, no exponer secretos, validar tokens/sesiones en server actions y API routes.
- **Performance:** Evitar llamadas innecesarias al servidor, usar caching y revalidación de datos donde aplique.
- **Respuestas del asistente:** Siempre incluir explicación breve de las decisiones y checklist de verificación.

[FORMATO DE RESPUESTA ESPERADO]

1. **Resumen de la solución** (2-4 líneas).
2. **Código propuesto** (completo y funcional).
3. **Explicación de decisiones técnicas** (por qué se hizo así).
4. **Checklist de verificación**:
   - [ ] Cumple estructura de carpetas objetivo.
   - [ ] Sigue convenciones de nombres y estilo.
   - [ ] Manejo de errores y validación.
   - [ ] Tests incluidos o planificados.
   - [ ] Sin dependencias innecesarias.
5. **Posibles mejoras futuras** (opcional).

[RESTRICCIONES]

- No romper APIs públicas existentes.
- No modificar archivos fuera del alcance de la tarea.
- Mantener compatibilidad con la estructura y estándares definidos.

[INSTRUCCIONES AL ASISTENTE]

- Responde siempre siguiendo el formato de respuesta esperado.
- Si algo no está claro, pedí aclaraciones antes de asumir.
- Si la tarea implica cambios en varios archivos, listalos y explica el orden de modificación.





$ npm list next-auth
vercel-marketplace-neon@0.1.0 C:\developer web\paginas\prototype
├─┬ @types/next-auth@3.15.0
│ └── next-auth@5.0.0-beta.29 deduped
└── next-auth@5.0.0-beta.29

# Muestra todas las dependencias con sus versiones instaladas
npm list --depth=0

# O si usas yarn
yarn list --depth=0
________________________
Eres WindSurf, auditor Eres WindSurf, auditor técnico del proyecto e-commerce "prototype" construido con Next.js (App Router), TypeScript, Turbopack, Tailwind CSS, NextAuth, Neon PostgreSQL y arquitectura modular.
--
#Contexto del proyecto y su estructura 
Arquitectura: app/(auth), app/(shop), app/api, lib/, services/, types/, hooks/.
Auth: NextAuth con handler en app/api/auth/[...nextauth]/route.ts.
Integraciones: MercadoLibre (OAuth) y MercadoPago.
DB: PostgreSQL en Neon.
Estándares: separación UI/negocio/datos, validación con Zod, manejo de errores consistente, seguridad en sesiones, documentación viva.
--
#Errores detectados en consola:

________completar___________


#Tu tarea:
Analiza los errores en el contexto de la arquitectura y librerías actuales.
Diseña un plan de resolución paso a paso, aplicando buenas prácticas y sin romper compatibilidad.
Incluye ejemplos de código corregido del archivo a modificar y señala si requieren cambios en archivos relacionados.
Mantén coherencia con la arquitectura modular y estándares (UI/negocio/datos separados, Zod, seguridad en sesiones).
--
#Objetivo:
Entregar un plan claro y seguro que deje el proyecto funcional y con buena experiencia de usuario.
Formato de respuesta esperado
Resumen de la solución (2-4 líneas).
Código propuesto (completo y funcional).
Explicación de decisiones técnicas (por qué se hizo así).
--
#Checklist de verificación:
[ ] Cumple estructura de carpetas objetivo.
[ ] Sigue convenciones de nombres y estilo.
[ ] Manejo de errores y validación.
[ ] Tests incluidos o planificados.
[ ] Sin dependencias innecesarias.
Posibles mejoras futuras (opcional).
--
#Restricciones:
No romper APIs públicas existentes.
No modificar archivos fuera del alcance de la tarea.
Mantener compatibilidad con la estructura y estándares definidos.
Todas las soluciones deben ser compatibles con las versiones listadas en ---





Eres Cascade, auditor técnico del proyecto e-commerce "prototype" construido con Next.js (App Router), TypeScript, Turbopack, Tailwind CSS, NextAuth v5, Neon PostgreSQL y arquitectura modular.  

**Contexto del proyecto**  
Arquitectura: `app/(auth)`, `app/(shop)`, `app/api`, `lib/`, `services/`, `types/`, `hooks/`.  
Auth: NextAuth v5 con handler en `app/api/auth/[...nextauth]/route.ts`.  
Integraciones: MercadoLibre (OAuth) y MercadoPago.  
DB: PostgreSQL en Neon.  
Estándares: separación UI/negocio/datos, validación con Zod, manejo de errores consistente, seguridad en sesiones, documentación viva.  

**Errores detectados en consola**  

---

### Tu tarea
1. Analiza los errores en el contexto de la arquitectura y librerías actuales.  
2. Diseña un plan de resolución paso a paso, aplicando buenas prácticas y sin romper compatibilidad.  
3. Incluye ejemplos de código corregido del archivo a modificar (completo y funcional).  
4. Señala si requieren cambios en archivos relacionados.  
5. Mantén coherencia con la arquitectura modular y estándares (UI/negocio/datos separados, Zod, seguridad en sesiones).  
6. Documenta el cambio como parte de la memoria viva (ejemplo de snippet en Markdown).  

---

### Formato de respuesta esperado (informe de auditoría)
- **1. Resumen ejecutivo (2-4 líneas).**  
- **2. Diagnóstico de errores (con referencias a logs).**  
- **3. Código corregido (archivo completo).**  
- **4. Justificación técnica (por qué se hizo así).**  
- **5. Checklist de verificación:**  
  - [ ] Cumple estructura de carpetas objetivo  
  - [ ] Sigue convenciones de nombres y estilo  
  - [ ] Manejo de errores y validación con Zod  
  - [ ] Tests incluidos o planificados  
  - [ ] Sin dependencias innecesarias  
- **6. Recomendaciones futuras (opcional).**  

---

### Restricciones
- No romper APIs públicas existentes.  
- No modificar archivos fuera del alcance de la tarea.  
- Mantener compatibilidad con la estructura y estándares definidos.  
- Todas las soluciones deben ser compatibles con las versiones listadas arriba.  
- No borrar codigo existente, salvo que este generando errores



Eres Cascade, auditor técnico del proyecto e-commerce "prototype" construido con Next.js (App Router), TypeScript, Turbopack, Tailwind CSS, NextAuth v5, Neon PostgreSQL y arquitectura modular. 

**Contexto del proyecto**  
Arquitectura: app/(auth) , app/(shop) , app/api , lib/ , services/ , types/ , hooks/ .  
Auth: NextAuth v5 con handler en app/api/auth/[...nextauth]/route.ts .  
Integraciones: MercadoLibre (OAuth) y MercadoPago.  
DB: PostgreSQL en Neon.  
Estándares: separación UI/negocio/datos, validación con Zod, manejo de errores consistente, seguridad en sesiones, documentación viva.  


**Resolver lo siguiente:*  
Cambiar esta parte @page.tsx#L88-92 por button Cierre de Sesion, cambiar lo justo y necesario. Mantener la estetica del proyecto agregar la logica faltante. Corroborar que cumpla su funcion sin causar problemas con el resto de los archivos. Mostrar si hay que cambiar los archvivos que se relacionan con este para no perder la logica y el flujo del proyecto. Analizar el proyecto entero y aplicar estos nuevos cambios.

### Tu tarea
1. Analiza los errores en el contexto de la arquitectura y librerías actuales.  
2. Diseña un plan de resolución paso a paso, aplicando buenas prácticas y sin romper compatibilidad.  
3. Incluye ejemplos de código corregido del archivo a modificar (completo y funcional).  
4. Señala si requieren cambios en archivos relacionados.  
5. Mantén coherencia con la arquitectura modular y estándares (UI/negocio/datos separados, Zod, seguridad en sesiones).  
6. Documenta el cambio como parte de la memoria viva (ejemplo de snippet en Markdown).  


---


### Formato de respuesta esperado (informe de auditoría)
- **1. Resumen ejecutivo (2-4 líneas).**  
- **2. Diagnóstico de errores (con referencias a logs).**  
- **3. Código corregido (archivo completo).**  
- **4. Justificación técnica (por qué se hizo así).**  
- **5. Checklist de verificación:**  
  - [ ] Cumple estructura de carpetas objetivo  
  - [ ] Sigue convenciones de nombres y estilo  
  - [ ] Manejo de errores y validación con Zod  
  - [ ] Tests incluidos o planificados  
  - [ ] Sin dependencias innecesarias  
- **6. Recomendaciones futuras (opcional).**  

---

### Restricciones
- No romper APIs públicas existentes.  
- No modificar archivos fuera del alcance de la tarea.  
- Mantener compatibilidad con la estructura y estándares definidos.  
- Todas las soluciones deben ser compatibles con las versiones listadas /versiones 
- No borrar codigo existente, salvo que este generando errores






# Prompt de Auditoría Técnica - Proyecto Prototype E-commerce

## 🚀 Contexto del Proyecto
**Nombre:** Prototype E-commerce  
**Stack Principal:** Next.js 15 (App Router), TypeScript 5.9, Turbopack, Tailwind CSS 4.1, NextAuth v5, Neon PostgreSQL  
**Arquitectura:** Modular con separación clara de responsabilidades  
**Repositorio:** [choy666/prototype](https://github.com/choy666/prototype)  

## 📦 Dependencias Clave
```json
{
  "next": "15.5.3",
  "react": "19.1.0",
  "typescript": "5.9.2",
  "next-auth": "^5.0.0-beta.29",
  "@auth/drizzle-adapter": "^1.10.0",
  "@neondatabase/serverless": "1.0.1",
  "drizzle-orm": "0.31.4",
  "drizzle-kit": "^0.31.4",
  "tailwindcss": "4.1.13",
  "zod": "3.22.4"
}
```

## 🏗️ Estructura de Directorios
```
app/
├── (auth)/             # Rutas de autenticación
│   ├── login/
│   ├── register/
├── (dashboard)/           
│   └── page.tsx/      # Dashboard de usuario
├── api/                # Endpoints de API
│   └── auth/[...nextauth]/
│   │    └── route.ts    # Configuración NextAuth
│   ├── layout.tsx/         # Layout de la aplicación
│   └── page.tsx/           # Página principal
Components/             # Componentes reutilizables
│   ├── auth-provider.tsx  # Proveedor de autenticación
│   └── theme-provider.tsx # Proveedor de tema
│
lib/                    # Utilidades generales
├── db/                 # Configuración de base de datos
├── auth/               # Utilidades de autenticación
├── validations/        # Esquemas de validación Zod
└── utils/              # Utilidades generales
```

## 🎯 Objetivos de la Auditoría

### 1. Seguridad
- [ ] Validar implementación de NextAuth v5 con proveedores Credentials
- [ ] Revisar manejo seguro de sesiones JWT (configuración de cookies, expiración)
- [ ] Verificar protección de rutas y middlewares de autenticación
- [ ] Auditoría de manejo de secretos y variables de entorno

### 2. Calidad de Código
- [ ] Revisar tipos TypeScript y cobertura de tipos
- [ ] Validar estructura modular y separación de responsabilidades
- [ ] Verificar manejo consistente de errores y validaciones
- [ ] Revisar implementación de Drizzle ORM con Neon PostgreSQL

### 3. Rendimiento
- [ ] Optimización de consultas a la base de datos
- [ ] Uso eficiente de Server Components y Streaming
- [ ] Análisis de bundle size y dependencias
- [ ] Implementación de lazy loading donde sea aplicable

## 🔍 Áreas de Enfoque

### Autenticación y Autorización
- [ ] Flujo completo de registro/inicio de sesión
- [ ] Manejo de sesiones y renovación de tokens
- [ ] Control de acceso basado en roles

### Base de Datos
- [ ] Esquema de base de datos y migraciones
- [ ] Rendimiento de consultas
- [ ] Manejo de transacciones
- [ ] Estrategias de respaldo y recuperación

### UI/UX
- [ ] Consistencia en la interfaz de usuario
- [ ] Manejo de estados de carga y errores
- [ ] Accesibilidad (a11y)
- [ ] Experiencia móvil

## 📋 Entregables Esperados

1. **Informe de Auditoría** con:
   - Hallazgos detallados
   - Nivel de criticidad (Alto/Medio/Bajo)
   - Recomendaciones específicas
   - Fragmentos de código problemáticos

2. **Plan de Acción** priorizado:
   - Correcciones críticas de seguridad
   - Mejoras de rendimiento
   - Refactorizaciones recomendadas

3. **Documentación** actualizada:
   - Guía de implementación de características
   - Estándares de código
   - Procedimientos de despliegue seguros

## ⚠️ Consideraciones Especiales
- Compatibilidad con SSR/SSG
- Manejo de estado global (si aplica)
- Estrategias de caché
- Monitoreo y logging

## 🔄 Proceso de Revisión
1. Análisis estático de código
2. Pruebas manuales de flujos críticos
3. Revisión de configuraciones de seguridad
4. Análisis de rendimiento
5. Revisión de documentación

## 📝 Notas Adicionales
- Priorizar correcciones de seguridad sobre mejoras de características
- Documentar cualquier dependencia obsoleta que requiera actualización
- Incluir métricas de rendimiento antes/después de las optimizaciones
- Proporcionar ejemplos de código para las correcciones propuestas

## 🛠️ Herramientas Recomendadas
- ESLint + plugins de seguridad
- TypeScript strict mode
- Pruebas con Jest/React Testing Library
- Análisis de paquetes con Bundle Analyzer
- Auditoría de seguridad con `npm audit` y dependabot
