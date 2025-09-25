---
description: Estructuta de app/ en relacion a products
auto_execution_mode: 1
---

app/
├── products/
│   ├── [id]/
│   │   └── page.tsx         # Página de detalle del producto
│   ├── page.tsx             # Listado de productos
│   ├── loading.tsx          # Estado de carga
│   └── not-found.tsx        # Página 404 para productos
│
components/
├── products/
│   ├── ProductCard.tsx      # Tarjeta de producto individual
│   ├── ProductGrid.tsx      # Grid de productos
│   ├── ProductFilters.tsx   # Filtros de búsqueda
│   ├── ProductSort.tsx      # Ordenamiento de productos
│   └── ProductDetails.tsx   # Componente de detalles del producto
│
lib/
├── api/
│   └── products/
│       ├── actions.ts       # Acciones CRUD de productos
│       └── queries.ts       # Consultas a la base de datos
└── types/
    └── products.ts          # Tipos específicos de productos