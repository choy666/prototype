# Plan de implementación: Categorías de Mercado Libre

## 1. Contexto y problema actual

Actualmente:

- Mercado Libre **requiere** que los productos se publiquen en **categorías hoja** (sin subcategorías).
- La primera solución intentó sincronizar **todo el árbol de categorías** de ML de forma recursiva, lo que genera:
  - Miles de requests a la API de ML.
  - Logs masivos (`🍃 Found leaf category...`).
  - Riesgo de **timeouts** y **rate limiting**.
- El objetivo ahora es tener una integración **simple, controlada y eficiente**:
  - Máx. **30 categorías hoja** bien elegidas.
  - Uso de `category_predictor` para **sugerir** categorías al crear/editar productos.

---

## 2. Objetivos de la solución

1. **Limitar el catálogo ML local** a un máximo de **30 categorías hoja oficiales**.
2. Mantener la tabla `categories` con el campo `isLeaf` para filtrar categorías válidas al crear/editar productos.
3. **No** descargar todo el árbol de ML: solo trabajar con categorías seleccionadas.
4. Implementar un endpoint que use **`category_predictor`** de ML para sugerir categorías a partir de título / descripción / precio.
5. Integrar las sugerencias en los formularios de **crear/editar producto**.
6. Seguir buenas prácticas:
   - Uso de endpoints oficiales de ML.
   - Manejo de errores y rate limiting.
   - Código desacoplado y fácil de mantener.

---

## 3. Diseño funcional

### 3.1. Catálogo de hasta 30 categorías oficiales ML

- El sistema tendrá una lista **curada** de hasta 30 categorías de Mercado Libre.
- Estas categorías:
  - Serán **hoja** (válidas para publicar productos).
  - Estarán guardadas en la tabla `categories` con `isLeaf = true` e `isMlOfficial = true`.
  - Podrán ajustarse con el tiempo, pero siempre respetando el límite de 30.

**Criterios para elegir las 30 categorías:**

- Deben reflejar los rubros donde realmente se venden productos en esta tienda.
- Se priorizan:
  - Categorías con mayor demanda en el mercado (ej: autos, electrónica, hogar, celulares, herramientas, etc.).
  - Categorías donde se concentran la mayoría de los productos del negocio.
- La selección de IDs debe hacerse consultando:
  - El **sitio web de Mercado Libre** navegando por categorías.
  - Y/o usando el recurso oficial `/sites/MLA/domain_discovery/search` y verificando cada categoría con `/categories/{id}`.

> Nota: a partir de estos criterios, se propone a continuación una lista concreta de ~30 categorías MLA obtenidas usando el recurso oficial `/sites/MLA/domain_discovery/search` y verificadas con `/categories/{id}`. Siempre es recomendable validar estos IDs navegando el árbol de categorías en el panel de Mercado Libre antes de usarlos en producción.

#### 3.1.1 Lista propuesta de categorías MLA

| # | Rubro negocio aproximado | mlCategoryId | Nombre categoría ML | Observaciones |
| --- | ------------------------ | ----------- | -------------------- | ------------- |
| 1 | Smartphones | MLA1055 | Celulares y Smartphones | Celulares y smartphones en general. Categoría hoja sin hijos. |
| 2 | Notebooks | MLA1652 | Notebooks | Portátiles de uso general. Categoría hoja. |
| 3 | Televisores Smart | MLA1002 | Televisores | Televisores LED/Smart TV. Categoría hoja. |
| 4 | Consolas de videojuegos | MLA438566 | Consolas | Consolas de juegos (PS, Xbox, etc.). |
| 5 | Heladeras | MLA398582 | Heladeras | Heladeras para hogar. |
| 6 | Microondas | MLA1577 | Microondas | Hornos microondas. |
| 7 | Lavarropas | MLA431202 | Lavarropas y Lavasecarropas | Lavarropas domésticos y lavasecarropas. |
| 8 | Aires acondicionados | MLA1644 | Aires Acondicionados | Equipos de aire acondicionado. |
| 9 | Zapatillas deportivas / calzado urbano | MLA109027 | Zapatillas | Zapatillas en Ropa y Accesorios → Calzado. Muy generalista. |
| 10 | Indumentaria femenina | MLA373770 | Vestidos | Ejemplo representativo de ropa femenina. |
| 11 | Indumentaria masculina | MLA109042 | Remeras, Musculosas y Chombas | Ropa superior masculina. |
| 12 | Perfumes y fragancias | MLA1271 | Perfumes | Perfumes y colonias. |
| 13 | Maquillaje | MLA43686 | Set de Maquillaje | Sets y kits de maquillaje. |
| 14 | Cuidado capilar | MLA414007 | Shampoos y Acondicionadores | Shampoos y acondicionadores para el pelo. |
| 15 | Muebles para living | MLA31045 | Juegos de Living | Juegos de sillones/mesas para living. |
| 16 | Colchones y sommiers | MLA1611 | Juegos de Sommier y Colchón | Conjunto colchón + base. |
| 17 | Sillas gamer | MLA447782 | Sillas Gamer | Sillas de oficina tipo gamer. |
| 18 | Herramientas eléctricas | MLA433672 | Eléctricos | Herramientas eléctricas dentro de Herramientas y construcción. |
| 19 | Bicicletas | MLA6143 | Bicicletas | Bicicletas tradicionales. |
| 20 | Motos | MLA1763 | Motos | Vehículos moto; accesorios irían en subcategorías relacionadas. |
| 21 | Neumáticos | MLA22195 | Neumáticos de Auto y Camioneta | Neumáticos para autos y camionetas. |
| 22 | Repuestos de freno (autos) | MLA61177 | Pastillas de Freno | Representante de repuestos de freno. |
| 23 | Juegos de mesa | MLA1161 | Juegos de Mesa y Cartas | Juegos de mesa y cartas. |
| 24 | Cochecitos para bebés | MLA1386 | Cochecitos para Bebés | Carritos/cochecitos de bebé. |
| 25 | Productos de limpieza | MLA127684 | Otros (Artículos de limpieza) | Categoría genérica de limpieza; afinar según catálogo real. |
| 26 | Alimentos para mascotas | MLA1087 | Alimentos Balanceados | Alimentos para perros/gatos. |
| 27 | Suplementos (salud y fitness) | MLA8830 | Suplementos Alimenticios | Suplementos nutricionales. |
| 28 | Hogar inteligente / smart speakers | MLA409415 | Asistentes Virtuales | Parlantes inteligentes / asistentes virtuales. |
| 29 | Electrónica de audio – parlantes BT | MLA8618 | Parlantes Portátiles | Parlantes Bluetooth/portátiles. |
| 30 | Electrónica de audio – auriculares | MLA3697 | Auriculares | Auriculares en general (incluye inalámbricos). |

Estas 30 filas representan **rubros de negocio** distintos, pero algunas comparten el mismo `mlCategoryId` (por ejemplo, calzado deportivo y urbano ambos en `MLA109027`). A nivel de base de datos, gracias a la restricción `unique` sobre `mlCategoryId`, esto se traduce en **menos de 30 filas reales** en la tabla `categories`, cumpliendo igualmente con el objetivo de mantener un catálogo acotado.

### 3.2. Comportamiento al crear/editar productos

- El formulario de producto tendrá un **selector de categoría ML** que:
  - Lista solamente las categorías de la tabla `categories` con `isLeaf = true`.
  - Máximo 30 opciones.
- Además, tendrá un botón, por ejemplo: **"Sugerir categoría ML"**, que:
  - Llama a un endpoint interno que usa `category_predictor`.
  - Sugiere una o varias categorías candidatas.
  - Si alguna sugerencia coincide con las 30 categorías configuradas, se selecciona automáticamente.

---

## 4. Diseño técnico

### 4.1. Modelo de datos (tabla `categories`)

Ya existe y contiene, entre otros:

- `mlCategoryId: text("ml_category_id").unique()`
- `isMlOfficial: boolean("is_ml_official").default(false).notNull()`
- `isLeaf: boolean("is_leaf").default(false).notNull()`

**Requisitos:**

- Todas las categorías oficiales de ML deben tener:
  - `mlCategoryId` = ID exacto de la categoría en ML.
  - `isMlOfficial = true`.
  - `isLeaf = true` solo si la categoría es realmente hoja (validada contra la API de ML).

### 4.2. Lógica de backend: `getCategories`

Ubicación: `lib/actions/categories.ts`

- Ya está implementado para devolver categorías, filtrando por defecto solo `isLeaf = true`.
- Mantener esta firma:

```ts
export async function getCategories(search?: string, onlyLeaf: boolean = true): Promise<Category[]>;
```

- Comportamiento esperado:
  - Si `onlyLeaf = true` → solo categorías hoja (`isLeaf = true`).
  - Si `search` está presente → filtrar por nombre con `LIKE`.

### 4.3. Nueva versión de `syncMLCategories`

**Objetivo:**

- Dejar de explorar todo el árbol de ML.
- Trabajar solo con un conjunto reducido de categorías (máx. 30), ya conocidas o configuradas.

**Estrategia técnica:**

1. Crear una **fuente de verdad** para las categorías a sincronizar:
   - Opción A (recomendada): tabla o seed de configuración, por ejemplo `ml_seed_categories` o un JSON local.
     - Campos mínimos: `mlCategoryId`, nombre de referencia, prioridad.
   - Opción B: introducir manualmente desde un formulario admin (ver sección 4.4).

2. `syncMLCategories()` hará:
   - Leer la lista de `mlCategoryId` a sincronizar (máx. 30).
   - Para cada categoría:
     - Llamar a `GET https://api.mercadolibre.com/categories/{id}`.
     - Validar que `children_categories` esté vacío (es categoría hoja).
     - Insertar/actualizar en `categories`:
       - `name` = `name` devuelto por ML.
       - `mlCategoryId` = ID.
       - `isMlOfficial = true`.
       - `isLeaf = true` si realmente es hoja.
       - `updated_at = new Date()`.
   - Respetar un **delay pequeño** entre requests (ej. 100–200ms) para reducir riesgo de rate limiting.

3. Límite de 30 categorías:
   - Antes de insertar:
     - Contar cuántas categorías `isMlOfficial = true` existen.
     - Si se superan 30, devolver un error claro:
       - `"Límite de 30 categorías ML oficiales alcanzado"`.

4. Manejo de errores:
   - Si una categoría no es hoja (tiene `children_categories`):
     - Registrar warning en logs.
     - No marcar `isLeaf = true`.
   - Si la llamada a la API de ML falla:
     - Log con mensaje, status y cuerpo de la respuesta.
     - Incrementar contador de errores en el resultado de sync.

#### 4.3.1 Seed inicial de categorías oficiales (ejemplo)

Una forma práctica de cargar estas categorías propuestas es crear un pequeño script de seed que inserte/actualice las filas correspondientes en la tabla `categories`.

```ts
// scripts/seed-ml-categories.ts (ejemplo)
import { db } from '@/lib/db';
import { categories } from '@/lib/schema';

const ML_OFFICIAL_CATEGORIES = [
  { mlCategoryId: 'MLA1055', name: 'Celulares y Smartphones' },
  { mlCategoryId: 'MLA1652', name: 'Notebooks' },
  { mlCategoryId: 'MLA1002', name: 'Televisores' },
  { mlCategoryId: 'MLA438566', name: 'Consolas' },
  { mlCategoryId: 'MLA398582', name: 'Heladeras' },
  { mlCategoryId: 'MLA1577', name: 'Microondas' },
  { mlCategoryId: 'MLA431202', name: 'Lavarropas y Lavasecarropas' },
  { mlCategoryId: 'MLA1644', name: 'Aires Acondicionados' },
  { mlCategoryId: 'MLA109027', name: 'Zapatillas' },
  { mlCategoryId: 'MLA373770', name: 'Vestidos' },
  { mlCategoryId: 'MLA109042', name: 'Remeras, Musculosas y Chombas' },
  { mlCategoryId: 'MLA1271', name: 'Perfumes' },
  { mlCategoryId: 'MLA43686', name: 'Set de Maquillaje' },
  { mlCategoryId: 'MLA414007', name: 'Shampoos y Acondicionadores' },
  { mlCategoryId: 'MLA31045', name: 'Juegos de Living' },
  { mlCategoryId: 'MLA1611', name: 'Juegos de Sommier y Colchón' },
  { mlCategoryId: 'MLA447782', name: 'Sillas Gamer' },
  { mlCategoryId: 'MLA433672', name: 'Eléctricos' },
  { mlCategoryId: 'MLA6143', name: 'Bicicletas' },
  { mlCategoryId: 'MLA1763', name: 'Motos' },
  { mlCategoryId: 'MLA22195', name: 'Neumáticos de Auto y Camioneta' },
  { mlCategoryId: 'MLA61177', name: 'Pastillas de Freno' },
  { mlCategoryId: 'MLA1161', name: 'Juegos de Mesa y Cartas' },
  { mlCategoryId: 'MLA1386', name: 'Cochecitos para Bebés' },
  { mlCategoryId: 'MLA127684', name: 'Otros (Artículos de limpieza)' },
  { mlCategoryId: 'MLA1087', name: 'Alimentos Balanceados' },
  { mlCategoryId: 'MLA8830', name: 'Suplementos Alimenticios' },
  { mlCategoryId: 'MLA409415', name: 'Asistentes Virtuales' },
  { mlCategoryId: 'MLA8618', name: 'Parlantes Portátiles' },
  { mlCategoryId: 'MLA3697', name: 'Auriculares' },
];

export async function seedMlCategories() {
  for (const cat of ML_OFFICIAL_CATEGORIES) {
    await db
      .insert(categories)
      .values({
        name: cat.name,
        mlCategoryId: cat.mlCategoryId,
        isMlOfficial: true,
        isLeaf: true, // asumimos hoja tras validar con /categories/{id}
      })
      .onConflictDoUpdate({
        target: categories.mlCategoryId,
        set: {
          name: cat.name,
          isMlOfficial: true,
          isLeaf: true,
          updated_at: new Date(),
        },
      });
  }
}
```

Este script es solo un ejemplo de referencia. En un entorno real puedes:

- Ejecutarlo desde un comando manual (por ejemplo, `ts-node scripts/seed-ml-categories.ts`).
- O bien mover esta lógica a una acción de administración protegida (solo usuarios admin) que rellene/actualice las categorías oficiales partiendo de este arreglo base.

### 4.4. Gestión de categorías ML desde el admin

Crear o extender pantalla en `/admin/mercadolibre` o `/admin/categories` para:

- **Listar** categorías oficiales de ML (`isMlOfficial = true`):
  - Mostrar `mlCategoryId`, nombre, `isLeaf`, fecha de actualización.
- **Agregar categoría ML manualmente**:
  - Input de texto: `mlCategoryId`.
  - Al guardar, el backend:
    - Llama a `GET /categories/{id}` en la API de ML.
    - Si es hoja → crear/actualizar en `categories` con `isLeaf = true`.
    - Si no es hoja → devolver error amigable: "Esta categoría no es hoja, selecciona una más específica".
    - Si ya hay 30 oficiales → rechazar con mensaje claro.

**Beneficios:**

- Control total del set de categorías.
- Posibilidad de ajustar el catálogo ML sin cambiar código.

### 4.5. Endpoint `category_predictor` interno

Nuevo endpoint: por ejemplo `POST /api/mercadolibre/category-predict`.

**Request** (ejemplo):

```json
{
  "title": "Llantas deportivas 17 pulgadas",
  "description": "Juego de llantas de aleación para auto, 17'", 
  "price": 250000
}
```

**Flujo interno:**

1. Validar sesión de usuario (solo admin).
2. Obtener access token de ML (reutilizar `MercadoLibreAuth`).
3. Construir request a:
   - `https://api.mercadolibre.com/sites/MLA/category_predictor/predict`.
   - Parámetros recomendados:
     - `title`: obligatorio.
     - `price`: opcional (puede mejorar precisión).
4. Recibir las predicciones:
   - Estructura típica: lista de categorías sugeridas con su `id`, `name` y `path_from_root`.
5. Filtrar predicciones para quedarse solo con categorías **hoja** (si la API no lo garantiza).
6. Cruzar esas categorías con la tabla `categories` local:
   - `WHERE mlCategoryId IN (predictedIds) AND isLeaf = true`.
7. Responder algo como:

```json
{
  "matchedCategories": [
    {
      "id": "<ml_category_id>",
      "name": "<nombre ML>",
      "path": "Autos y Camionetas > Accesorios para Vehículos > Llantas"
    }
  ],
  "rawPredictions": [
    { "id": "...", "name": "...", "path": "..." }
  ]
}
```

### 4.6. Integración en formularios de producto

Ubicaciones:

- `app/admin/products/new/page.tsx`
- `app/admin/products/[id]/edit/page.tsx`

**Cambios funcionales:**

1. El `Select` de categoría ML debe seguir usando:
   - `GET /api/admin/categories` → que ya llama a `getCategories(onlyLeaf = true)`.
   - Por lo tanto, solo mostrará las categorías hoja oficiales (máx. 30).

2. Añadir botón "Sugerir categoría ML":
   - En el formulario, cerca del selector de categoría.
   - Al pulsarlo:
     - Leer los valores actuales de:
       - Título (`name`).
       - Descripción.
       - Precio.
     - Llamar vía `fetch` al endpoint `POST /api/mercadolibre/category-predict`.
     - Si `matchedCategories` no está vacío:
       - Preseleccionar la primera coincidencia en el `Select`.
       - Mostrar un mensaje tipo: "Categoría sugerida por Mercado Libre: ...".
     - Si no hay coincidencias:
       - Mostrar mensaje: "No se encontraron sugerencias dentro de tus categorías configuradas. Revisa la configuración de categorías ML".

3. Validación al guardar producto:
   - Asegurar que `mlCategoryId` esté presente.
   - Mensaje claro si falta: "Debes seleccionar una categoría de Mercado Libre".

---

## 5. Flujo de trabajo recomendado

### 5.1. Para el desarrollador

1. **Refactorizar `syncMLCategories`** para que:
   - Deje de usar recursión masiva.
   - Solo sincronice categorías presentes en una lista configurada (o ingresadas por admin).
   - Respete el límite de 30.

2. **Implementar endpoint `category-predict`**:
   - Reutilizar lógica de autenticación con ML (`MercadoLibreAuth`).
   - Manejar errores de la API de ML con logs claros.

3. **Actualizar formularios de producto** para integrar:
   - Botón "Sugerir categoría ML".
   - Selección automática cuando haya coincidencias.

4. **Agregar pantalla / sección de gestión de categorías ML** en el admin.

### 5.2. Para el operador (usuario admin)

1. Definir rubros principales del negocio.
2. Navegar en Mercado Libre y elegir hasta 30 categorías hoja relevantes.
3. En el admin:
   - Agregar esas categorías (pegando el `ml_category_id`).
   - Ejecutar la sincronización para validar nombres y `isLeaf`.
4. Al crear/editar productos:
   - Usar "Sugerir categoría ML" como ayuda.
   - Revisar que todos los productos tengan categoría ML válida antes de sincronizar.

---

## 6. Testing y validación

### 6.1. Pruebas unitarias (idealmente)

- Mockear llamadas a la API de ML para:
  - `GET /categories/{id}`.
  - `category_predictor`.
- Probar `syncMLCategories` con:
  - Categorías hoja.
  - Categorías no-hoja.
  - Errores de red / respuestas 4xx/5xx.
- Probar endpoint `category-predict` con distintos títulos y precios (usando mocks).

### 6.2. Pruebas manuales

1. Configurar 3–5 categorías de prueba en el admin.
2. Ejecutar `syncMLCategories` y verificar en la BD:
   - `isLeaf = true` solo para categorías hoja reales.
3. Crear producto nuevo:
   - Usar "Sugerir categoría ML" y comprobar que se selecciona una categoría de la lista.
4. Sincronizar el producto con ML:
   - Confirmar que **no aparece** el error `item.category_id.invalid`.

---

## 7. Riesgos y mitigaciones

- **Riesgo:** Elegir mal las 30 categorías (no representan el catálogo real).
  - **Mitigación:** Revisar periódicamente las ventas y ajustar la lista de categorías oficiales.

- **Riesgo:** Cambios en la API de ML (`category_predictor` o estructura de categorías).
  - **Mitigación:** Encapsular llamadas a ML en funciones específicas (`MercadoLibreAuth`, helpers de categorías) para actualizar en un solo lugar.

- **Riesgo:** Rate limiting de ML si se sincroniza con demasiada frecuencia.
  - **Mitigación:**
    - Usar delays entre requests.
    - Sincronizar solo bajo demanda (cuando se cambian categorías oficiales), no en cada request.

---

## 8. Checklist de implementación

1. [ ] Refactorizar `syncMLCategories` para usar lista de categorías configuradas (sin recursión masiva).
2. [ ] Implementar control de límite de 30 categorías oficiales.
3. [ ] Crear o ajustar UI admin para gestionar categorías ML (alta/baja/edición).
4. [ ] Implementar endpoint `POST /api/mercadolibre/category-predict`.
5. [ ] Integrar botón "Sugerir categoría ML" en formularios de producto.
6. [ ] Validar en BD que los productos nuevos tengan siempre un `mlCategoryId` válido.
7. [ ] Probar la sincronización de productos con ML y verificar que desaparecen los errores de categoría no-hoja.
