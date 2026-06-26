--
-- Estructura para la tabla cart_items
--

DROP TABLE IF EXISTS "cart_items" CASCADE;

CREATE TABLE "cart_items" (
  "id" integer DEFAULT nextval('cart_items_id_seq'::regclass) NOT NULL,
  "cart_id" integer NOT NULL,
  "product_id" integer NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Estructura para la tabla carts
--

DROP TABLE IF EXISTS "carts" CASCADE;

CREATE TABLE "carts" (
  "id" integer DEFAULT nextval('carts_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Estructura para la tabla order_items
--

DROP TABLE IF EXISTS "order_items" CASCADE;

CREATE TABLE "order_items" (
  "id" integer DEFAULT nextval('order_items_id_seq'::regclass) NOT NULL,
  "order_id" integer NOT NULL,
  "product_id" integer NOT NULL,
  "quantity" integer NOT NULL,
  "price" numeric NOT NULL,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Estructura para la tabla orders
--

DROP TABLE IF EXISTS "orders" CASCADE;

CREATE TABLE "orders" (
  "id" integer DEFAULT nextval('orders_id_seq'::regclass) NOT NULL,
  "user_id" integer NOT NULL,
  "total" numeric NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "payment_id" text,
  "mercado_pago_id" text,
  "shipping_address" jsonb,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Estructura para la tabla products
--

DROP TABLE IF EXISTS "products" CASCADE;

CREATE TABLE "products" (
  "id" integer DEFAULT nextval('products_id_seq'::regclass) NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price" numeric NOT NULL,
  "image" text,
  "category" text NOT NULL,
  "destacado" boolean DEFAULT false NOT NULL,
  "stock" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Datos para la tabla products
--

INSERT INTO "products" ("id", "name", "description", "price", "image", "category", "destacado", "stock", "created_at", "updated_at") VALUES
(1, 'Producto 1', 'Descripción del producto 1', '99.99', 'https://ejemplo.com/imagen1.jpg', 'Electrónicos', true, 50, Thu Sep 18 2025 13:15:49 GMT-0300 (hora estándar de Argentina), Thu Sep 18 2025 13:15:49 GMT-0300 (hora estándar de Argentina)),
(2, 'Producto 2', 'Descripción del producto 2', '149.99', 'https://ejemplo.com/imagen2.jpg', 'Hogar', false, 30, Thu Sep 18 2025 13:15:49 GMT-0300 (hora estándar de Argentina), Thu Sep 18 2025 13:15:49 GMT-0300 (hora estándar de Argentina)),
(3, 'Producto 3', 'Descripción del producto 3', '199.99', 'https://ejemplo.com/imagen3.jpg', 'Electrónicos', true, 20, Thu Sep 18 2025 13:15:49 GMT-0300 (hora estándar de Argentina), Thu Sep 18 2025 13:15:49 GMT-0300 (hora estándar de Argentina));

--
-- Estructura para la tabla users
--

DROP TABLE IF EXISTS "users" CASCADE;

CREATE TABLE "users" (
  "id" integer DEFAULT nextval('users_id_seq'::regclass) NOT NULL,
  "email" character varying NOT NULL,
  "name" character varying NOT NULL,
  "created_at" timestamp without time zone DEFAULT now() NOT NULL,
  "password" character varying,
  "email_verified" timestamp without time zone,
  "image" text,
  "role" text DEFAULT 'user'::text NOT NULL,
  "mercado_libre_id" character varying,
  "mercado_libre_access_token" text,
  "mercado_libre_refresh_token" text,
  "updated_at" timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Datos para la tabla users
--

INSERT INTO "users" ("id", "email", "name", "created_at", "password", "email_verified", "image", "role", "mercado_libre_id", "mercado_libre_access_token", "mercado_libre_refresh_token", "updated_at") VALUES
(4, 'test1@gmail.com', 'test', Wed Sep 24 2025 02:37:49 GMT-0300 (hora estándar de Argentina), '$2b$12$1YyNDyh.wt8VxpJyLZpTXeLGT1OnD6mqYg1MExJMYNtc0vMRKoqdi', Wed Sep 24 2025 02:37:49 GMT-0300 (hora estándar de Argentina), NULL, 'user', NULL, NULL, NULL, Wed Sep 24 2025 02:37:49 GMT-0300 (hora estándar de Argentina)),
(5, 'test2@gmail.com', 'testb', Wed Sep 24 2025 22:07:48 GMT-0300 (hora estándar de Argentina), '$2b$12$OI9TVS/kgNwkO4RTJOKn4OO0AamFd1rXg1HvFSHs2.0x3cmP/KF3m', Wed Sep 24 2025 22:07:48 GMT-0300 (hora estándar de Argentina), NULL, 'user', NULL, NULL, NULL, Wed Sep 24 2025 22:07:48 GMT-0300 (hora estándar de Argentina));

