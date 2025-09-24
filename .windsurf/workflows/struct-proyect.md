---
description: # Estructura Final del Proyecto
auto_execution_mode: 1
---

prototype/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   ├── register/
│   │   │   └── route.ts
│   │   ├── checkout/
│   │   │   └── route.ts
│   │   └── callback/mercadolibre/
│   │       └── route.ts
│   ├── dashboard/
│   │   └── page.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── lib/
│   ├── actions/
│   │   ├── auth.ts
│   │   └── products.ts
│   ├── utils/
│   │   └── coockies.ts
│   ├── validations/
│   │   └── auth.ts
│   ├── db.ts
│   ├── mercadolibre.ts
│   ├── mercadopago.ts
│   └── schema.ts
│
├── types/
│   ├── user.ts
│   ├── product.ts
│   ├── order.ts
│   ├── cart.ts
│   └── next-auth.d.ts
│
├── public/
│   ├── images/
│   └── favicon.ico
│
├── drizzle.config.ts
├── eslint.config.ts
├── middleware.ts
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json