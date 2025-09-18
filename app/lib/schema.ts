import { pgTable, serial, text, decimal, boolean, integer, timestamp } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  image: text('image'),
  category: text('category').notNull(),
  destacado: boolean('destacado').default(false).notNull(),
  stock: integer('stock').default(0).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;