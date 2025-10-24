import {
  pgTable,
  serial,
  text,
  decimal,
  boolean,
  integer,
  timestamp,
  varchar,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

// ======================
// User roles type
// ======================
export type UserRole = "user" | "admin";

// ======================
// Productos
// ======================
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  image: text("image"),
  category: text("category").notNull(),
  destacado: boolean("destacado").default(false).notNull(),
  stock: integer("stock").default(0).notNull(),
  discount: integer("discount").default(0).notNull(), // porcentaje de descuento
  weight: decimal("weight", { precision: 5, scale: 2 }), // peso en kg, opcional para cálculo de envío
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ======================
// Usuarios
// ======================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 256 }).unique().notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  password: varchar("password", { length: 256 }), // Para autenticación tradicional
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  mercadoLibreId: varchar("mercado_libre_id", { length: 100 }), // Para OAuth
  mercadoLibreAccessToken: text("mercado_libre_access_token"),
  mercadoLibreRefreshToken: text("mercado_libre_refresh_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ======================
// Carrito
// ======================
export const carts = pgTable("carts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ======================
// Ítems del carrito
// ======================
export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  cartId: integer("cart_id")
    .references(() => carts.id, { onDelete: "cascade" })
    .notNull(),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  quantity: integer("quantity").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ======================
// Enum de estados de orden
// ======================
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
  "rejected",
]);

// ======================
// Direcciones de envío
// ======================
export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  nombre: varchar("nombre", { length: 256 }).notNull(),
  direccion: text("direccion").notNull(),
  ciudad: varchar("ciudad", { length: 256 }).notNull(),
  provincia: varchar("provincia", { length: 256 }).notNull(),
  codigoPostal: varchar("codigo_postal", { length: 10 }).notNull(),
  telefono: varchar("telefono", { length: 20 }).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ======================
// Métodos de envío
// ======================
export const shippingMethods = pgTable("shipping_methods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // ej: "Envío Estándar", "Envío Express"
  baseCost: decimal("base_cost", { precision: 10, scale: 2 }).notNull(), // costo base
  weightMultiplier: decimal("weight_multiplier", { precision: 5, scale: 2 }).default("0").notNull(), // multiplicador por kg
  zoneMultiplier: decimal("zone_multiplier", { precision: 5, scale: 2 }).default("1").notNull(), // multiplicador por zona
  freeThreshold: decimal("free_threshold", { precision: 10, scale: 2 }), // monto mínimo para envío gratis
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ======================
// Órdenes
// ======================
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: orderStatusEnum("status").default("pending").notNull(), // 👈 ahora tipado fuerte
  paymentId: text("payment_id"),
  mercadoPagoId: text("mercado_pago_id"),
  shippingAddress: jsonb("shipping_address"),
  shippingMethodId: integer("shipping_method_id").references(() => shippingMethods.id),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).default("0").notNull(),
  trackingNumber: text("tracking_number"), // Número de seguimiento
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ======================
// Ítems de la orden
// ======================
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .references(() => orders.id, { onDelete: "cascade" })
    .notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ======================
// Tipos TypeScript
// ======================
export type User = typeof users.$inferSelect & {
  id: string;
};

export type Product = typeof products.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type NewProduct = typeof products.$inferInsert;
export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;
export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
export type ShippingMethod = typeof shippingMethods.$inferSelect;
export type NewShippingMethod = typeof shippingMethods.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
