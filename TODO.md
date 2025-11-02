# TODO: Implementación de Atributos y Variantes en Nuevo Producto

## Estado Actual
- ✅ Tablas `product_attributes` y `product_variants` definidas en `lib/schema.ts`
- ✅ API para atributos en `app/api/admin/product-attributes/route.ts` (GET, POST, PUT, DELETE)
- ✅ UI en `app/admin/products/new/page.tsx` para seleccionar atributos y generar variantes
- ❌ Falta API para crear variantes: `/api/admin/products/[id]/variants`
- ❌ Posiblemente faltan atributos por defecto (Talla, Color)

## Pasos de Implementación

### 1. Crear API para Variantes
- [ ] Crear archivo `app/api/admin/products/[id]/variants/route.ts`
- [ ] Implementar endpoint POST para crear variantes de un producto
- [ ] Validar datos con Zod
- [ ] Usar `createProductVariant` de `lib/actions/productVariants.ts`

### 2. Verificar Atributos por Defecto
- [ ] Revisar si existen atributos "Talla" y "Color" en la base de datos
- [ ] Si no existen, crearlos con valores comunes:
  - Talla: ["XS", "S", "M", "L", "XL", "XXL"]
  - Color: ["Rojo", "Azul", "Verde", "Negro", "Blanco", "Gris"]

### 3. Probar Funcionalidad
- [ ] Crear un producto con atributos seleccionados
- [ ] Verificar que se generen las variantes correctamente
- [ ] Comprobar que las variantes se guarden en la base de datos
- [ ] Probar en el frontend que aparezcan las opciones de variantes

### 4. Mejoras Opcionales
- [ ] Agregar validación para evitar atributos duplicados en variantes
- [ ] Implementar edición de variantes después de crear el producto
- [ ] Agregar imágenes específicas para cada variante
- [ ] Mostrar preview de combinaciones de atributos

## Corroboración de Tablas de Base de Datos

### product_attributes
- id: serial primary key
- name: text (ej: "Talla", "Color")
- values: jsonb (array de strings, ej: ["S", "M", "L"])
- created_at, updated_at: timestamps

### product_variants
- id: serial primary key
- productId: integer references products.id
- sku: text (opcional)
- attributes: jsonb (objeto, ej: {"Talla": "M", "Color": "Rojo"})
- price: decimal (opcional, precio específico de variante)
- stock: integer default 0
- image: text (opcional, imagen específica)
- isActive: boolean default true
- created_at, updated_at: timestamps

## Notas Técnicas
- Las variantes se generan automáticamente como combinaciones cartesianas de los atributos seleccionados
- El stock base del producto se mantiene, pero las variantes tienen stock individual
- Las variantes pueden tener precio específico o heredar del producto
- Usar `isActive` para "eliminar" variantes sin borrar datos
