# Guía rápida: cantidad en publicaciones de Mercado Libre

## 1. Cómo calcula el backend la `available_quantity`

En la sincronización de productos (`/api/mercadolibre/products/sync`), la cantidad que se envía a Mercado Libre se calcula con:

- `resolveStockPolicy({ categoryId, condition, listingTypeId })`
- `calculateAvailableQuantityForML(stockLocal, stockPolicy, maxPerListing?)`

### 1.1 Política de stock

Actualmente la política es:

- Si `listing_type_id === 'free'` → `stockPolicy = 'UNIQUE'`
- En cualquier otro caso → `stockPolicy = 'MULTI'`

### 1.2 Resultado práctico

Dado un producto con `stock` en la base local:

- Si la publicación es **free**:
  - El backend **siempre envía `available_quantity = 1` a Mercado Libre**, sin importar si el stock local es 5, 10 o 100.
  - El stock real queda guardado solo en tu sistema; Mercado Libre ve una publicación de unidad única.

- Si la publicación **no es free** (en este proyecto se usa `gold_special` como tipo pago):
  - El backend envía, por defecto, `available_quantity = stockLocal` (salvo que en el futuro se use un `maxPerListing` explícito).

Esto aplica **para todas las categorías** que uses, incluyendo las siguientes:

- MLA1652
- MLA3697
- MLA8618
- MLA409415
- MLA8830
- MLA1087
- MLA127684
- MLA1386
- MLA1161
- MLA61177
- MLA22195
- MLA1763
- MLA6143
- MLA433672
- MLA447782
- MLA1611
- MLA31045
- MLA414007
- MLA43686
- MLA1271
- MLA109042
- MLA373770
- MLA109027
- MLA1644
- MLA431202
- MLA1577
- MLA398582
- MLA438566
- MLA1002
- MLA1055

No hay lógica distinta por categoría: **el factor determinante hoy es el tipo de publicación (`listing_type_id`)**.

---

## 2. Qué significa esto para armar publicaciones sin errores

### 2.1 Publicaciones free

Para cualquier categoría con `listing_type_id = 'free'`:

- La publicación en Mercado Libre se comporta como **unidad única**.
- Si el negocio necesita vender muchas unidades del mismo producto:
  - El stock real (ej.: 15 unidades) se guarda en tu sistema.
  - Pero cada publicación free mostrará y permitirá comprar **solo 1 unidad** por operación de sincronización.

Esto es consistente con las restricciones que Mercado Libre impone en varias combinaciones de categoría + condición + tipo de publicación, donde devuelve errores como:

- `item.available_quantity.invalid` con mensajes del estilo `max. value is 1`.

Al mandar siempre 1 en publicaciones free, se evita ese error para las categorías usadas en el proyecto.

### 2.2 Publicaciones pagas (gold_special)

Si necesitás:

- Publicar **más de 1 unidad** en Mercado Libre desde una sola publicación, y
- Evitar errores de cantidad máxima,

entonces la recomendación es:

- Usar tipos de publicación **pagos** (en este proyecto, `gold_special`), donde Mercado Libre suele permitir `available_quantity > 1` (según la categoría).
- En esas publicaciones, el backend mandará **todo el stock local** como `available_quantity` por defecto.

---

## 3. Checklist rápido para quien arma la publicación

Antes de sincronizar un producto con Mercado Libre, revisar:

1. **Tipo de publicación (`ml_listing_type_id`)**
   - ¿Quiero una publicación free de unidad única? → usar `free`.
   - ¿Quiero mostrar varias unidades en una sola publicación? → usar un tipo de publicación pago.

2. **Stock local (`stock`)**
   - Puede ser cualquier número (el backend lo usa como referencia interna).
   - En publicaciones free, Mercado Libre **solo verá 1 unidad**.

3. **Categoría y atributos**
   - Usar las categorías configuradas en el proyecto (ver `docs/categories.json`).
   - Completar los atributos obligatorios y recomendados (ver `docs/guiaSync.md` y el `AttributeBuilder` en el panel admin).

Con este esquema:

- El negocio mantiene su stock real completo en el sistema.
- Las publicaciones en Mercado Libre respetan las restricciones típicas de cantidad para las publicaciones free.
- Para publicaciones pagas, se envía la cantidad real, lo que permite vender varias unidades del mismo ítem desde una sola publicación.
