---
description: # Estructura Final del Proyecto
auto_execution_mode: 1
---

app/
│
├── (auth)/
│ ├── login/page.tsx
│ ├── register/page.tsx
│ ├── mercadolibre/page.tsx // Login con Mercado Libre (OAuth)
│ └── layout.tsx
│
├── (shop)/
│ ├── products/
│ │ ├── page.tsx // Lista de productos
│ │ └── [id]/page.tsx // Detalle de producto
│ ├── cart/page.tsx // Carrito de compras
│ ├── checkout/page.tsx // Proceso de pago (Mercado Pago)
│ └── layout.tsx
│
├── (dashboard)/ // Opcional: panel admin
│ ├── products/
│ ├── orders/
│ └── account/page.tsx
│
├── api/
│ ├── auth/
│ │ ├── register/route.ts
│ │ ├── login/route.ts
│ │ ├── logout/route.ts
│ │ └── mercadolibre/route.ts // Callback OAuth ML
│ ├── products/
│ │ ├── route.ts // GET lista (puede venir de tu DB o de ML)
│ │ └── [id]/route.ts // GET detalle
│ ├── cart/
│ │ ├── route.ts // GET/POST carrito
│ │ └── [id]/route.ts // PUT/DELETE item carrito
│ ├── checkout/
│ │ ├── route.ts // Crea preferencia de pago MP
│ │ └── webhook/route.ts // Webhook confirmación pago MP
│ └── orders/
│ ├── route.ts // GET/POST pedidos
│ └── [id]/route.ts // GET detalle pedido
│
lib/
│ ├── db.ts // Conexión DB
│ ├── schema.ts // Tablas (users, products, orders, cart, etc.)
│ ├── mercadopago.ts // Configuración SDK Mercado Pago
│ ├── mercadolibre.ts // Configuración OAuth + API ML
│ └── actions/
│ ├── auth.ts
│ ├── products.ts // Puede integrar API ML
│ ├── cart.ts
│ ├── checkout.ts // Lógica de pago con MP
│ └── orders.ts
│
components/
│ ├── products/ // Cards, listas, filtros
│ ├── cart/ // Vista carrito
│ ├── checkout/ // Formulario pago/envío o Bricks MP
│ └── ui/ // Botones, inputs, modales
│
services/
│ ├── payment.ts // Abstrae pagos (usa mercadopago.ts)
│ ├── email.ts // Confirmaciones
│ └── mercadolibre-api.ts // Funciones para interactuar con ML
│
types/
│ ├── product.ts
│ ├── order.ts
│ ├── cart.ts
│ └── user.ts
│
hooks/
│ ├── useCart.ts // Estado global carrito
│ ├── useAuth.ts
│ └── useMercadoLibreAuth.ts // Manejo de login con ML
