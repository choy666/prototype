---
description: # Estructura gral y convenciones del proyecto prototype
auto_execution_mode: 1
---

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

- **Lenguaje:** TypeScript + React Server Components (Next.js 15+ App Router).
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