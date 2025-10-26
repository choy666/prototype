'use server';

import { db } from '../db';
import { orders, orderItems, products, users } from '../schema';
import { eq, desc, and, gte, lte, like, sql } from 'drizzle-orm';
import type { Order } from '../schema';
import { revalidatePath } from 'next/cache';

// Obtener órdenes con paginación y filtros para admin
export async function getOrders(
  page = 1,
  limit = 10,
  filters: {
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: 'createdAt' | 'total' | 'status';
    sortOrder?: 'asc' | 'desc';
  } = {}
) {
  try {
    const offset = (page - 1) * limit;
    const { status, search, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

    // Construir condiciones de filtro
    const conditions = [];
    if (status) {
      conditions.push(eq(orders.status, status as 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'rejected'));
    }
    if (search) {
      conditions.push(like(users.email, `%${search}%`));
    }
    if (dateFrom) {
      conditions.push(gte(orders.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(orders.createdAt, new Date(dateTo)));
    }

    // Obtener órdenes con información del usuario
    const ordersQuery = db
      .select({
        id: orders.id,
        userId: orders.userId,
        total: orders.total,
        status: orders.status,
        paymentId: orders.paymentId,
        mercadoPagoId: orders.mercadoPagoId,
        shippingAddress: orders.shippingAddress,
        shippingMethodId: orders.shippingMethodId,
        shippingCost: orders.shippingCost,
        trackingNumber: orders.trackingNumber,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        userEmail: users.email,
        userName: users.name,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sortOrder === 'desc' ? desc(orders[sortBy]) : sql`${orders[sortBy]} asc`)
      .limit(limit)
      .offset(offset);

    // Obtener conteo total
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [ordersData, countResult] = await Promise.all([ordersQuery, countQuery]);
    const total = Number(countResult[0]?.count ?? 0);

    // Obtener items para cada orden
    const ordersWithItems = await Promise.all(
      ordersData.map(async (order) => {
        const items = await db
          .select({
            id: orderItems.id,
            quantity: orderItems.quantity,
            price: orderItems.price,
            productId: orderItems.productId,
            productName: products.name,
          })
          .from(orderItems)
          .leftJoin(products, eq(orderItems.productId, products.id))
          .where(eq(orderItems.orderId, order.id));

        return {
          ...order,
          total: Number(order.total),
          shippingCost: Number(order.shippingCost),
          items,
          itemCount: items.length,
        };
      })
    );

    return {
      data: ordersWithItems,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error('Error fetching orders:', error);
    return {
      data: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      },
    };
  }
}

// Obtener una orden por ID con detalles completos
export async function getOrderById(id: number): Promise<Order & { items: { id: string; quantity: number; price: number; productId: number; productName: string; productImage: string | null; }[]; userEmail: string | null; userName: string | null } | null> {
  try {
    // Obtener orden con información del usuario
    const orderData = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        total: orders.total,
        status: orders.status,
        paymentId: orders.paymentId,
        mercadoPagoId: orders.mercadoPagoId,
        shippingAddress: orders.shippingAddress,
        shippingMethodId: orders.shippingMethodId,
        shippingCost: orders.shippingCost,
        trackingNumber: orders.trackingNumber,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        userEmail: users.email,
        userName: users.name,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(eq(orders.id, id))
      .limit(1);

    if (orderData.length === 0) {
      return null;
    }

    // Obtener items de la orden
    const items = await db
      .select({
        id: orderItems.id,
        quantity: orderItems.quantity,
        price: orderItems.price,
        productId: orderItems.productId,
        productName: products.name,
        productImage: products.image,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, id));

    const order = orderData[0];
    const transformedItems = items.map(item => ({
      id: item.id.toString(),
      quantity: item.quantity,
      price: Number(item.price),
      productId: item.productId,
      productName: item.productName || 'Producto desconocido',
      productImage: item.productImage,
    }));

    return {
      ...order,
      items: transformedItems,
    };
  } catch (error) {
    console.error('Error fetching order by id:', error);
    return null;
  }
}

// Actualizar estado y tracking de una orden
export async function updateOrderStatus(
  id: number,
  updates: {
    status?: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'rejected';
    trackingNumber?: string;
  }
): Promise<Order | null> {
  try {
    const [updatedOrder] = await db
      .update(orders)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();

    revalidatePath(`/admin/orders/${id}`);
    revalidatePath('/admin/orders');
    return updatedOrder || null;
  } catch (error) {
    console.error('Error updating order:', error);
    throw new Error('No se pudo actualizar la orden');
  }
}

// Generar reportes básicos de pedidos
export async function generateOrderReports(filters: {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
} = {}) {
  try {
    const { dateFrom, dateTo, status } = filters;

    const conditions = [];
    if (status) {
      conditions.push(eq(orders.status, status as 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'rejected'));
    }
    if (dateFrom) {
      conditions.push(gte(orders.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(orders.createdAt, new Date(dateTo)));
    }

    // Estadísticas generales
    const statsQuery = db
      .select({
        totalOrders: sql<number>`count(*)`,
        totalRevenue: sql<number>`sum(${orders.total})`,
        averageOrderValue: sql<number>`avg(${orders.total})`,
      })
      .from(orders)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Órdenes por estado
    const statusQuery = db
      .select({
        status: orders.status,
        count: sql<number>`count(*)`,
      })
      .from(orders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(orders.status);

    const [stats, statusData] = await Promise.all([statsQuery, statusQuery]);

    return {
      stats: stats[0],
      statusBreakdown: statusData,
    };
  } catch (error) {
    console.error('Error generating order reports:', error);
    throw new Error('No se pudieron generar los reportes');
  }
}
