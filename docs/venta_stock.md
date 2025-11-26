# Flujo de ventas y stock

Este documento describe cómo funciona actualmente el flujo de **ventas** y **stock** en el proyecto, tanto para ventas web propias como para ventas realizadas a través de Mercado Libre, y cómo se sincroniza el inventario hacia Mercado Libre.

---

## 1. Modelo de stock

### 1.1. Tablas principales

- **`products`**
  - Campo clave: `stock` → representa el **stock real disponible** del producto base.
  - Otros campos relevantes para ML: `mlItemId`, `mlCategoryId`, `mlSyncStatus`, etc.

- **`productVariants`**
  - Campos clave: `stock`, `isActive`, `productId`.
  - Cada variante tiene su propio stock, separado del producto base.
  - `isActive` indica si la variante está disponible para la venta (normalmente `true` cuando `stock > 0`).

- **`stockLogs`**
  - Tabla de **historial de movimientos de stock**.
  - Campos relevantes:
    - `productId`: producto afectado.
    - `variantId` (nullable): variante afectada (si aplica).
    - `oldStock`: stock anterior al cambio.
    - `newStock`: stock posterior al cambio.
    - `change`: diferencia aplicada (positiva o negativa).
    - `reason`: motivo del cambio ("Venta web", "Venta ML - Orden X", "Ajuste manual", etc.).
    - `userId`: usuario que realizó la acción (o usuario asociado al flujo automatizado).
    - `created_at`: fecha del movimiento.

### 1.2. Servicios de dominio de stock y ML

En `lib/domain/ml-stock.ts` se centraliza la lógica de cómo se transforma el **stock real** en un `available_quantity` válido para Mercado Libre:

- **`resolveStockPolicy({ categoryId, condition, listingTypeId })`**
  - Devuelve una política de stock (`UNIQUE` o `MULTI`) en función de la categoría y el tipo de publicación.
  - Ejemplo de regla conocida: algunas combinaciones de categoría + condición + listing type solo permiten `available_quantity = 1`.

- **`calculateAvailableQuantityForML(stock, policy)`**
  - Aplica la política devuelta por `resolveStockPolicy` al stock real.
  - Si la política es `UNIQUE` → si `stock > 0`, devuelve `1`.
  - Si la política es `MULTI` → devuelve el stock real (posiblemente capado por algún máximo).

- **`calculateAvailableQuantityFromProduct(product)`**
  - Helper que toma el producto (y su categoría ML, condición, etc.) y devuelve el `available_quantity` correcto para ese ítem en Mercado Libre.

**Idea clave:**

- El **stock real** vive solo en la base de datos.
- `available_quantity` en ML es una **proyección calculada** y nunca se considera fuente de verdad.

---

## 2. Flujo de venta web (carrito propio)

Archivo principal: `app/api/webhooks/mercadopago/route.ts`.

### 2.1. Resumen

1. Mercado Pago notifica un pago (webhook).
2. El backend valida el pago y crea la orden local.
3. Se generan los `order_items` asociados.
4. Se descuenta el stock correspondiente utilizando los servicios de stock.
5. Se registra el movimiento en `stockLogs`.
6. Opcionalmente, se sincroniza después el stock hacia Mercado Libre (según la configuración del proyecto).

### 2.2. Descuento de stock en venta web

- Para cada ítem del carrito se aplica uno de estos caminos:
  - **Si el ítem corresponde a una variante** (producto con variantes):
    - Se llama a `adjustVariantStock({ variantId, change, reason }, { bypassAuth, userId })`.
  - **Si el ítem es solo producto base**:
    - Se llama a `adjustProductStock({ productId, change, reason }, { bypassAuth, userId })`.

Ambas funciones (`adjustProductStock` y `adjustVariantStock`) viven en `lib/actions/stock.ts` y hacen lo siguiente:

- Validan los parámetros (`zod`).
- Resuelven el `userId` (ya sea del `session.user.id` o por bypass en caso de webhooks).
- Obtienen el stock actual desde BD.
- Realizan una **actualización atómica** del stock usando SQL:
  - `stock = GREATEST(0, stock + change)` para evitar valores negativos incluso con concurrencia.
- Leen el nuevo stock real después del `UPDATE`.
- Insertan un registro en `stockLogs` con `oldStock`, `newStock`, `change`, `reason` y `userId`.
- Revalidan las rutas de admin relacionadas (`/admin/products/...`).

**Resultado:**

- Cada venta web queda reflejada como un cambio de stock con su historial trazable.
- Los servicios de stock son el **punto único** para ajustar stock desde la aplicación.

---

## 3. Flujo de venta por Mercado Libre (importación de órdenes)

Archivo principal: `app/api/mercadolibre/orders/import/route.ts`.

### 3.1. Resumen del flujo de importación

1. Se consulta la API de Mercado Libre para obtener órdenes (por ID o en lote).
2. Para cada orden de ML:
   - Se verifica si ya existe un registro de importación o una orden local asociada a ese `mlOrderId`.
   - Si ya existe, se marca como `skipped` y no se duplica.
   - Si no existe, se crea una nueva orden local en la tabla `orders`.
3. Se mapean los `order_items` de ML a productos locales:
   - Se busca cada ítem por `products.mlItemId`.
   - Se llenan los `orderItems` locales con `productId`, `quantity`, `price`, etc.
4. Se registra la importación en `mercadolibreOrdersImport`.
5. **Se descuenta el stock local de forma transaccional.**

### 3.2. Deducción transaccional de stock en venta ML

La parte crítica para el stock está en la sección donde, una vez creada la orden local y los `orderItems`, se ejecuta una **transacción** (`db.transaction`) para deducir stock:

- Se itera sobre `orderItemsData` dentro de la transacción.
- Para cada ítem:
  1. Se busca el `product` local y sus variantes activas (`variants` con `isActive = true`).
  2. Se intenta deducir primero de una variante:
     - Si alguna variante tiene `stock >= quantity` del ítem:
       - Se hace un `UPDATE` atómico sobre `productVariants.stock`:
         - `stock = stock - quantity` (vía SQL, dentro de la transacción).
       - Se inserta un `stockLogs` con:
         - `productId`, `variantId`, `oldStock`, `newStock`, `change`, `reason`, `userId`.
       - Se registra en logs de aplicación que se dedujo stock de variante.
  3. Si no se pudo deducir de ninguna variante (por stock insuficiente u otras razones):
     - Se deduce del **producto base**:
       - `UPDATE` atómico sobre `products.stock` dentro de la transacción.
       - Se inserta un `stockLogs` con la información del producto base.

Todo este proceso ocurre **dentro de una única transacción** por orden importada, lo que garantiza que:

- O se actualiza el stock de todos los ítems correctamente, o no se aplica nada (rollback en caso de error).
- No hay riesgo de dejar el sistema en un estado inconsistente si algo falla a mitad de procesamiento.

**Diferencias respecto a la venta web:**

- En venta web se usan directamente `adjustProductStock` / `adjustVariantStock`.
- En venta ML, para tener más control transaccional sobre varios ítems a la vez, se actúa directamente sobre la BD dentro de `db.transaction`, replicando la misma filosofía (actualizaciones atómicas + logs), pero a nivel "batch".

---

## 4. Sincronización de stock hacia Mercado Libre

Archivo principal: `lib/services/mercadolibre/inventory.ts`.

### 4.1. `syncInventoryToMercadoLibre`

Esta función toma el **stock real local** y lo proyecta a `available_quantity` en ML:

1. Obtiene la lista de productos a sincronizar:
   - Todos los productos activos con `mlSyncStatus = 'synced'`, o
   - Un `productId` específico si se pasa como parámetro.
2. Para cada producto:
   - Lee `product.stock` de la BD.
   - Calcula `availableQuantity` usando `calculateAvailableQuantityFromProduct(product)`.
   - Hace un `PUT` a la API de ML:
     - `PUT /items/:mlItemId` con `{ available_quantity: availableQuantity }`.
   - Actualiza `mlLastSync` y `updated_at` en la tabla `products`.
   - Registra en logs de aplicación el resultado de la sincronización.

**Importante:**

- En ningún momento se pisa el stock local con datos de ML.
- El flujo es siempre **local → ML**, usando el dominio de stock para respetar las políticas de categoría.

---

## 5. Monitoreo bidireccional (solo lectura)

Archivo principal: `lib/services/mercadolibre/inventory.ts`, función `bidirectionalInventorySync`.

### 5.1. Comportamiento actual

- Esta función ya **no actualiza** el stock local con datos de ML.
- Su rol actual es **solo de monitoreo**:
  1. Lee el `stock` local del producto desde la BD.
  2. Obtiene el ítem de ML vía `GET /items/:mlItemId`.
  3. Calcula la discrepancia: `discrepancy = localStock - mlStock`.
  4. Si hay discrepancia, registra un `logger.warn` con los valores de ambos lados.
  5. Si el `localStock` es **menor** que `mlStock`, actualiza ML para evitar sobreventa:
     - Vuelve a calcular `availableQuantity` con `calculateAvailableQuantityFromProduct`.
     - Hace `PUT /items/:mlItemId` con ese nuevo `available_quantity`.

### 5.2. Razón de diseño

- Anteriormente, esta función podía actualizar el stock local tomando valores de ML, lo que generaba riesgo de inconsistencia.
- Ahora, respeta la regla de que el stock real vive solo en la BD local.
- ML se ajusta hacia abajo si está "por encima" del stock real, pero nunca se toma ML como fuente de verdad para incrementar stock local.

---

## 6. Invariantes y reglas de negocio clave

- **Fuente de verdad del stock**: la base de datos local (`products.stock`, `productVariants.stock`) es el único lugar donde vive el stock real.
- **`available_quantity` en ML es derivado**: siempre se calcula a partir del stock real más la política de categoría/listing.
- **Ventas web**:
  - Descuentan stock usando `adjustProductStock` / `adjustVariantStock`.
  - Cada cambio registra un `stockLogs` con trazabilidad completa.
- **Ventas ML (importadas)**:
  - Crean órdenes locales y luego descuentan stock dentro de una transacción.
  - Mantienen logs detallados en `stockLogs`, incluyendo `variantId` cuando aplica.
- **Sincronización con ML**:
  - Solo empuja stock desde local hacia ML.
  - Nunca pisa el stock local con lo que venga de ML.
- **Monitoreo bidireccional**:
  - Sirve para detectar discrepancias entre local y ML.
  - Solo corrige ML hacia abajo si su `available_quantity` es mayor que lo que permite el stock real.

Con este diseño, el sistema minimiza el riesgo de sobreventa y mantiene una trazabilidad clara de todos los cambios de stock, tanto para ventas web como para ventas realizadas en Mercado Libre.

---

## 7. Flujo editorial de productos y sincronización con Mercado Libre

En la práctica, el flujo recomendado para los productos que también deben existir en Mercado Libre es el siguiente:

1. **Crear o editar el producto en el admin** (`/admin/products/...`).
   - Definir nombre, descripción, imágenes, precio, stock y categoría interna.
   - Configurar los campos específicos de ML en la ficha del producto (categoría ML, tipo de publicación, condición, atributos ML, etc.).

2. **Revisar que el producto esté "listo para ML"**:
   - Stock local > 0 (si se va a vender en ML).
   - Categoría de Mercado Libre válida (categoría hoja).
   - Atributos obligatorios completos (por ejemplo, BRAND/MODEL en algunas categorías).
   - Imágenes accesibles y en buena calidad.

3. **Pulsar el botón "Sincronizar" en la lista de productos** (`/admin/products`):
   - Si el producto **no tiene** `mlItemId` → se **crea** una nueva publicación en Mercado Libre.
   - Si el producto **ya tiene** `mlItemId` → se **actualiza** la publicación existente con la información actual del producto local.
   - El stock enviado a ML se calcula desde el stock real local usando el dominio de `ml-stock` (políticas por categoría).

4. **Mantener la edición principal en el admin**:
   - Cualquier cambio importante (precio, descripción, imágenes, atributos) debe hacerse en el admin.
   - Tras los cambios, se puede volver a usar "Sincronizar" para reflejar ese estado en la ficha de ML.

5. **Evitar editar manualmente en ML lo que proviene del admin**:
   - La publicación de ML se considera un "espejo controlado" del producto local.
   - El stock **nunca** se ajusta desde ML hacia la BD; siempre se parte del stock real local y se proyecta hacia ML.

De esta forma, el catálogo de la tienda y el catálogo de Mercado Libre comparten la misma información de negocio relevante (nombre, precio, descripción, atributos, imágenes y stock proyectado), pero la **fuente de verdad** sigue siendo siempre el producto definido en el admin y el stock almacenado en la base de datos local.
