"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderItems = exports.orders = exports.cartItems = exports.carts = exports.users = exports.products = void 0;
//lib/schema.ts
var pg_core_1 = require("drizzle-orm/pg-core");
//productos
exports.products = (0, pg_core_1.pgTable)('products', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description'),
    price: (0, pg_core_1.decimal)('price', { precision: 10, scale: 2 }).notNull(),
    image: (0, pg_core_1.text)('image'),
    category: (0, pg_core_1.text)('category').notNull(),
    destacado: (0, pg_core_1.boolean)('destacado').default(false).notNull(),
    stock: (0, pg_core_1.integer)('stock').default(0).notNull(),
    created_at: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updated_at: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
//usuarios    
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    email: (0, pg_core_1.varchar)('email', { length: 256 }).unique().notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 256 }).notNull(),
    password: (0, pg_core_1.varchar)('password', { length: 256 }), // Para autenticación tradicional
    emailVerified: (0, pg_core_1.timestamp)('email_verified'),
    image: (0, pg_core_1.text)('image'),
    role: (0, pg_core_1.text)('role', { enum: ['user', 'admin'] }).default('user').notNull(),
    mercadoLibreId: (0, pg_core_1.varchar)('mercado_libre_id', { length: 100 }), // Para OAuth
    mercadoLibreAccessToken: (0, pg_core_1.text)('mercado_libre_access_token'),
    mercadoLibreRefreshToken: (0, pg_core_1.text)('mercado_libre_refresh_token'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
//carrito
exports.carts = (0, pg_core_1.pgTable)('carts', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').references(function () { return exports.users.id; }, { onDelete: 'cascade' }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// Ítems del carrito
exports.cartItems = (0, pg_core_1.pgTable)('cart_items', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    cartId: (0, pg_core_1.integer)('cart_id').references(function () { return exports.carts.id; }, { onDelete: 'cascade' }).notNull(),
    productId: (0, pg_core_1.integer)('product_id').references(function () { return exports.products.id; }, { onDelete: 'cascade' }).notNull(),
    quantity: (0, pg_core_1.integer)('quantity').default(1).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// Órdenes
exports.orders = (0, pg_core_1.pgTable)('orders', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').references(function () { return exports.users.id; }).notNull(),
    total: (0, pg_core_1.decimal)('total', { precision: 10, scale: 2 }).notNull(),
    status: (0, pg_core_1.text)('status').default('pending').notNull(), // 'pending', 'paid', 'shipped', 'delivered', 'cancelled'
    paymentId: (0, pg_core_1.text)('payment_id'),
    mercadoPagoId: (0, pg_core_1.text)('mercado_pago_id'),
    shippingAddress: (0, pg_core_1.jsonb)('shipping_address'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// Ítems de la orden
exports.orderItems = (0, pg_core_1.pgTable)('order_items', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    orderId: (0, pg_core_1.integer)('order_id').references(function () { return exports.orders.id; }, { onDelete: 'cascade' }).notNull(),
    productId: (0, pg_core_1.integer)('product_id').references(function () { return exports.products.id; }).notNull(),
    quantity: (0, pg_core_1.integer)('quantity').notNull(),
    price: (0, pg_core_1.decimal)('price', { precision: 10, scale: 2 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
