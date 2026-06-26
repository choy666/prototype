# Guía de sincronización de productos con Mercado Libre

## Objetivo

Esta guía explica **qué revisar al crear/editar un producto** para que la sincronización con Mercado Libre sea exitosa, usando las categorías (`ml_category_id`) configuradas en este proyecto.

Se apoya en:

- `docs/categories.json`: categorías internas con su `ml_category_id` de Mercado Libre.
- `docs/products.json`: ejemplo(s) de producto con campos `ml_category_id`, `ml_condition`, `ml_buying_mode`, `ml_listing_type_id`, etc.
- Documentación oficial de atributos de Mercado Libre (endpoint `/categories/{category_id}/attributes`).

---

## 1. Conceptos clave

- **ml_category_id**: categoría de Mercado Libre (ej.: `MLA1055` para *Celulares y Smartphones*).
- **Atributos del ítem**: características como Marca, Modelo, Color, etc. Definidos por categoría.
- **Atributos obligatorios**: si no se informan, Mercado Libre rechaza la publicación o la sincronización.
- **Atributos de variación**: atributos con los que se pueden crear variantes (ej.: Color, Capacidad).

---

## 2. Cómo saber qué atributos exige Mercado Libre para una categoría

Mercado Libre publica los atributos por categoría en el endpoint `categories/{id}/attributes`.

1. Tomar el `ml_category_id` desde tu sistema.
   - Ejemplo real de tu proyecto: `MLA1055` (Celulares y Smartphones) en `docs/products.json`.
2. Consultar la API de atributos:

> Si necesitás depurar o entender un caso particular, sigue siendo útil llamar manualmente a
> `GET /categories/{ml_category_id}/attributes` para ver la respuesta cruda de Mercado Libre.

---

## 3. Categorías usadas en este proyecto

Las categorías del proyecto están definidas en `docs/categories.json` y cada una tiene un `ml_category_id`.

Ejemplos (extraídos de tu JSON):

- **Accesorios para Vehículos** → `MLA5725`
- **Agro** → `MLA1512`
- **Alimentos y Bebidas** → `MLA1403`
- **Animales y Mascotas** → `MLA1071`
- **Antigüedades y Colecciones** → `MLA1367`
- **Arte, Librería y Mercería** → `MLA1368`
- **Autos, Motos y Otros** → `MLA1743`
- **Bebés** → `MLA1384`
- **Belleza y Cuidado Personal** → `MLA1246`
- **Cámaras y Accesorios** → (ver `docs/categories.json`)
- ...

Además, en `docs/products.json` ya tienes al menos un producto real con:

- `ml_category_id`: `MLA1055` (Celulares y Smartphones)

En esta guía, el ejemplo detallado se centra en **MLA1055 (Celulares y Smartphones)**, pero el flujo aplica igual para cualquier categoría del JSON.

---

## 4. Checklist general mínimo (aplica a todas las categorías)

Al crear o editar un producto **antes de sincronizar con Mercado Libre**, verificar como mínimo:

### 4.1 Datos básicos del producto

- [ ] **Nombre/Título** claro y descriptivo.
- [ ] **Descripción** con información suficiente (características principales, uso, etc.).
- [ ] **Precio** definido en la moneda correspondiente (`ml_currency_id`, ej.: `ARS`).
- [ ] **Stock** disponible (`available_quantity` o campo equivalente en tu sistema).
- [ ] **Condición** (`ml_condition`):
  - [ ] `new` si es nuevo.
  - [ ] `used` si es usado.
- [ ] **Modo de compra** (`ml_buying_mode`), típicamente `buy_it_now`.
- [ ] **Tipo de publicación** (`ml_listing_type_id`), ej.: `free`, `gold_special`, etc.

### 4.2 Imágenes y multimedia

- [ ] Al menos **1 imagen** de buena calidad.
- [ ] Preferible **varias imágenes** que muestren el producto desde distintos ángulos.
- [ ] (Opcional) **Video** (`ml_video_id`) si aplica.

### 4.3 Medidas físicas y peso (importante para envíos)

En tu JSON de producto ya manejas, por ejemplo:

- `weight`
- `height`
- `width`
- `length`

Checklist:

- [ ] Peso cargado con unidades correctas.
- [ ] Alto, ancho y largo completados.
- [ ] Dimensiones coherentes con el tipo de producto (no valores absurdos).

### 4.4 Atributos generales

Aunque cambian según categoría, hay atributos **casi universales** que conviene siempre completar:

- [ ] **Marca** (`BRAND` / "Marca").
- [ ] **Modelo** (`MODEL` / "Modelo").
- [ ] Otros atributos marcados como `required` para la categoría.

> Si faltan atributos obligatorios (ej.: Marca y Modelo), la sincronización puede fallar con errores similares a:
> "Faltan atributos obligatorios para Mercado Libre (por ejemplo, Marca y Modelo)".

### 4.5 Cómo se ve esto en el backoffice (AttributeBuilder)

Cuando en el panel de administración:

- Creas un producto nuevo, o
- Editas un producto existente,

y seleccionas la **Categoría Mercado Libre**:

1. El front llama automáticamente a:
   - `GET /api/mercadolibre/categories/{mlCategoryId}/attributes`.
2. Ese endpoint interno obtiene los atributos desde la API oficial de Mercado Libre y los traduce al formato que usa `AttributeBuilder`.
3. En la pestaña de **Atributos del Producto**, `AttributeBuilder` muestra arriba un bloque:
   - *"Atributos recomendados por Mercado Libre para esta categoría"*.
   - Cada atributo recomendado/obligatorio aparece como un **chip** con:
     - El nombre + ID de ML (ej.: `Marca (BRAND)`).
     - El texto `(obligatorio)` si `required == true`.
     - Un color de estado según si ya lo cargaste o no:
       - **Verde** (borde y punto): el atributo ya está presente en la lista de atributos dinámicos del producto (coincide con algún alias).
       - **Amarillo** (borde y punto): el atributo está recomendado por ML, pero todavía **no fue cargado**.

> Nota: actualmente los atributos obligatorios que faltan se ven como recomendados pendientes (amarillos) pero con la etiqueta `(obligatorio)`. 
> La validación estricta sigue ocurriendo al sincronizar con Mercado Libre; si falta un obligatorio, la API puede rechazar la publicación.

---

## 5. Checklist específico: Celulares y Smartphones (MLA1055)

Esta es la categoría que ya estás usando en `docs/products.json`.

### 5.1 Atributos mínimos recomendados para MLA1055

Para **Celulares y Smartphones** (MLA1055), Mercado Libre suele exigir o valorar especialmente:

- [ ] **Marca** (`BRAND`)
  - Ejemplos válidos: `Apple`, `Samsung`, `Motorola`, etc.
- [ ] **Modelo** (`MODEL`)
  - Ejemplo: `iPhone 14 Pro Max`, `Galaxy S23`, etc.
- [ ] **Línea** o familia del modelo (según los atributos que devuelva la categoría)
  - Ejemplo: `iPhone`, `Galaxy S`, `Moto G`, etc.
- [ ] **Color principal** del equipo (`COLOR` u otro atributo con `allow_variations`).
- [ ] **Capacidad de almacenamiento interno** (ej.: 128 GB, 256 GB).
- [ ] **Memoria RAM** (ej.: 6 GB, 8 GB).
- [ ] **Conectividad / Operadora** (si aplica, ej.: liberado de fábrica).
- [ ] **Condición** (`new` / `used`).

Pasos sugeridos para esta categoría:

1. Llamar a `GET /categories/MLA1055/attributes`.
2. Identificar **todos los atributos con `tags.required == true`**.
3. Mapear desde tu modelo de producto (por ejemplo, `attributes` en `docs/products.json`) a esos IDs/atributos de Mercado Libre.
4. Completar también los atributos marcados como `catalog_required` para mejorar exposición.

### 5.2 Variantes típicas para MLA1055

Los celulares suelen tener variantes por:

- **Color** (ej.: Negro, Plata, Azul, Violeta).
- **Capacidad de almacenamiento** (ej.: 128 GB, 256 GB, 512 GB).

En la respuesta de atributos de la categoría:

- Busca los atributos con `tags.allow_variations == true` (por ejemplo `COLOR`).
- Úsalos como base para definir las variantes en tu sistema.

Checklist de variantes:

- [ ] Elegir 1 o más atributos con `allow_variations == true` (ej.: Color, Capacidad).
- [ ] Para cada variante, completar **todos los atributos obligatorios** del ítem.
- [ ] Para cada variante, revisar que título, fotos y atributos sean coherentes:
  - Ej.: variante "Negro 256 GB" → fotos del color negro, atributos de 256 GB, etc.

---

## 6. Flujo sugerido al crear/editar un producto en tu backoffice

1. **Elegir categoría interna** → se obtiene el `ml_category_id` desde `categories.json`.
2. **(Automático en este proyecto)**: al seleccionar la *Categoría Mercado Libre* en el formulario, el backoffice llama a
   `GET /api/mercadolibre/categories/{mlCategoryId}/attributes` y muestra en `AttributeBuilder`:
   - Atributos marcados como obligatorios (`required` / `catalog_required`).
   - Atributos marcados como `allow_variations` (candidatos a variación).
   Esto reemplaza la necesidad de que el usuario consulte manualmente la API para el uso cotidiano.
3. **(Opcional / para debugging)**: si necesitás ver la respuesta cruda de la API de ML, puedes llamar a
   `GET https://api.mercadolibre.com/categories/{mlCategoryId}/attributes` y contrastarla con lo que muestra el backoffice.
4. **Completar ficha de producto** en tu sistema con:
   - Datos básicos (título, descripción, precio, stock, imágenes).
   - Medidas físicas y peso.
   - Atributos mínimos (Marca, Modelo, etc.).
5. **Definir variantes** (si aplica):
   - Elegir atributos de variación permitidos por la categoría.
   - Crear las combinaciones (Color x Capacidad, etc.).
6. **Validar antes de sincronizar**:
   - [ ] ¿Todos los atributos `required` de la categoría tienen valor?
   - [ ] ¿Las variantes usan solo atributos con `allow_variations`?
   - [ ] ¿Los valores son coherentes (ej.: Marca y Modelo reales)?
7. **Ejecutar la sincronización** desde tu app.
8. Si hay error en `mercadolibre_products_sync`:
   - Leer el `sync_error` guardado (ej.: faltan atributos).
   - Corregir la ficha del producto siguiendo esta guía y reintentar.

---

## 7. Cómo extender esta guía a otras categorías de `categories.json`

Para cada nueva categoría que empieces a usar:

1. Identificar el `ml_category_id` en `docs/categories.json`.
2. Llamar a `GET /categories/{ml_category_id}/attributes`.
3. Armar una mini-lista de:
   - Atributos `required`.
   - Atributos `allow_variations`.
4. Añadir una sección similar a la de **MLA1055** en este archivo con:
   - "Atributos mínimos recomendados".
   - "Variantes típicas".

De esta forma, tu equipo tendrá siempre una **guía concreta por categoría** para crear/editar productos y lograr una sincronización exitosa con Mercado Libre.

---

## 8. Mapeo a catálogo de atributos (product_attributes)

Además de los atributos cargados dinámicamente en cada producto, el proyecto ahora tiene una capa de **mapeo a catálogo de Mercado Libre** basada en una tabla y una UI interna.

### 8.1. Tabla `product_attributes`

En `lib/schema.ts` existe la tabla `product_attributes`:

- `name`: nombre interno del atributo (ej.: `Color`, `Talla`, `Material`).
- `mlAttributeId`: ID del atributo en el catálogo de ML (ej.: `COLOR`, `SIZE`, `BRAND`).
- `values`: arreglo JSON de valores posibles, por ejemplo:
  - `[{ name: "Negro", mlValueId: "52049" }, { name: "Blanco", mlValueId: "52050" }]`.

Esta tabla es la **fuente de verdad del mapeo a catálogo** que luego se utiliza al sincronizar productos con Mercado Libre.

### 8.2. UI interna de atributos de producto

Para gestionar esta tabla sin tocar la base de datos directamente, existe una UI de administración:

- `/admin/product-attributes` → listado de atributos de catálogo:
  - Muestra `name`, `mlAttributeId` y cuántos `values` tiene cada uno.
  - Permite editar o eliminar cada atributo.
- `/admin/product-attributes/new` → creación de un nuevo atributo de catálogo:
  - Campos: `name`, `mlAttributeId` y una lista de valores `{ name, mlValueId }`.
- `/admin/product-attributes/[id]/edit` → edición de un atributo existente.

Con esta UI se puede mantener el catálogo de valores oficiales (por ejemplo, todos los colores válidos para ML) sin cambios de código.

### 8.3. Uso en el sincronizador de productos

En `app/api/mercadolibre/products/sync/route.ts`, antes de enviar los `attributes` del ítem a ML se hace lo siguiente:

1. Se cargan todos los registros de `product_attributes` desde la base de datos.
2. Se mapean los atributos dinámicos del producto (`attributes` del producto) a la estructura que espera ML, usando la función `mapProductAttributesToMercadoLibreAttributes`.
3. Esta función:
   - Intenta identificar el atributo por nombre (ej.: `Color`, `Marca`, `Modelo`).
   - Si existe un registro en `product_attributes` para ese nombre:
     - Usa `mlAttributeId` como `id` del atributo en ML cuando aplique.
     - Busca en `values` un valor cuyo `name` coincida (normalizado) con el valor del producto.
     - Si encuentra match, envía también `value_id = mlValueId`.

**Ejemplo simplificado:**

- En `product_attributes` tienes:
  - `name = "Color"`, `mlAttributeId = "COLOR"`, `values = [{ name: "Negro", mlValueId: "52049" }]`.
- En el producto, en el backoffice, cargas un atributo dinámico:
  - `name = "Color"`, `values = ["Negro"]`.
- El mapper construye para ML:
  - `{ id: "COLOR", name: "Color", value_name: "Negro", value_id: "52049" }`.

Esto reduce warnings del tipo `item.attribute.missing_catalog_required` y mejora el alineamiento con el catálogo oficial de Mercado Libre.

### 8.4. Sugerencias de valores en AttributeBuilder

El componente `AttributeBuilder` ahora puede mostrar **sugerencias de valores de catálogo** para facilitar la carga correcta de atributos:

- Para cada atributo cargado (por ejemplo, `Color`), debajo del campo "Valor del atributo" aparece un botón:
  - **"Ver sugerencias ML"**.
- Al hacer click:
  - Llama internamente a `GET /api/admin/ml-attributes/{attributeName}/values?q=...`.
  - Este endpoint consulta `product_attributes` y devuelve los valores configurados para ese atributo (filtrando opcionalmente por el texto actual).
  - Se muestran chips clicables con valores sugeridos (ej.: `Negro`, `Blanco`, `Rojo`).
  - Al seleccionar un chip, se rellena automáticamente el valor del atributo del producto con ese texto.

El mismo patrón se aplica en el formulario de **nuevo atributo** dentro de `AttributeBuilder`:

- Si escribes el nombre del atributo (por ejemplo, `Color`) y pulsas "Ver sugerencias ML", se muestran valores de catálogo para elegir.

### 8.5. Resumen práctico para el equipo

Para aprovechar al máximo el mapeo a catálogo:

1. Mantener actualizado `/admin/product-attributes` con los atributos clave (Color, Talla, Material, etc.) y sus valores oficiales de ML.
2. Al cargar atributos en un producto, usar el botón **"Ver sugerencias ML"** para elegir siempre valores que existan en el catálogo.
3. Revisar que, para atributos importantes (como Color, Marca, Modelo y otros `catalog_required`), los valores se correspondan con los configurados en `product_attributes`.
4. Si en la respuesta de ML aparecen warnings de catálogo, ajustar primero `product_attributes` y luego volver a sincronizar el producto.

De esta forma, el proyecto no solo cumple con los mínimos de atributos obligatorios, sino que también se alinea cada vez más con el catálogo oficial de Mercado Libre, mejorando la calidad y visibilidad de las publicaciones.
