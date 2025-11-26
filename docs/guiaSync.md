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

   ```bash
   curl -X GET -H "Authorization: Bearer $ACCESS_TOKEN" \
     https://api.mercadolibre.com/categories/MLA1055/attributes
   ```

3. En la respuesta, revisar por cada atributo:
   - Campo `id` y `name` (ej.: `"id": "BRAND", "name": "Marca"`).
   - Campo `tags`:
     - `tags.required == true`: **atributo obligatorio para publicar**.
     - `tags.catalog_required == true`: requerido si quieres asociar a un catálogo oficial.
     - `tags.allow_variations == true`: se puede usar como **atributo de variación** (ej.: `COLOR`).

> Recomendación: para cada `ml_category_id` que uses, guarda en una nota interna o config el listado de:
> - Atributos con `tags.required == true` (mínimo obligatorio).
> - Atributos con `tags.allow_variations == true` (posibles variantes).

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
2. **Consultar atributos de la categoría** en la API de Mercado Libre (al menos una vez por categoría) y documentar:
   - Atributos `required`.
   - Atributos `allow_variations`.
3. **Completar ficha de producto** en tu sistema con:
   - Datos básicos (título, descripción, precio, stock, imágenes).
   - Medidas físicas y peso.
   - Atributos mínimos (Marca, Modelo, etc.).
4. **Definir variantes** (si aplica):
   - Elegir atributos de variación permitidos por la categoría.
   - Crear las combinaciones (Color x Capacidad, etc.).
5. **Validar antes de sincronizar**:
   - [ ] ¿Todos los atributos `required` de la categoría tienen valor?
   - [ ] ¿Las variantes usan solo atributos con `allow_variations`?
   - [ ] ¿Los valores son coherentes (ej.: Marca y Modelo reales)?
6. **Ejecutar la sincronización** desde tu app.
7. Si hay error en `mercadolibre_products_sync`:
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
