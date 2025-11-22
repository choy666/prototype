'use server';

import { db } from '../db';
import { orders, orderItems, products, users, productVariants, mercadolibreOrdersImport } from '../schema';
import { eq, desc, and, gte, lte, like, sql } from 'drizzle-orm';
import type { Order } from '../schema';
import { revalidatePath } from 'next/cache';
import { makeAuthenticatedRequest } from '@/lib/auth/mercadolibre';

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
        cancellationReason: orders.cancellationReason,
        cancelledAt: orders.cancelledAt,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        // Campos de Mercado Libre
        mlOrderId: orders.mlOrderId,
        source: orders.source,
        mlStatus: orders.mlStatus,
        mlBuyerInfo: orders.mlBuyerInfo,
        mlShippingInfo: orders.mlShippingInfo,
        mlPaymentInfo: orders.mlPaymentInfo,
        mlFeedback: orders.mlFeedback,
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

// Cancelar una orden
export async function cancelOrder(orderId: number, userId: number, reason: string): Promise<Order | null> {
  try {
    // Verificar que la orden existe y pertenece al usuario
    const existingOrder = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
      .limit(1);

    if (existingOrder.length === 0) {
      throw new Error('Orden no encontrada o no pertenece al usuario');
    }

    const order = existingOrder[0];

    // Verificar que la orden puede ser cancelada (no entregada o ya cancelada)
    if (order.status === 'delivered' || order.status === 'cancelled') {
      throw new Error('La orden no puede ser cancelada en su estado actual');
    }

    // Actualizar la orden
    const [updatedOrder] = await db
      .update(orders)
      .set({
        status: 'cancelled',
        cancellationReason: reason,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    // Restaurar stock de los productos
    const orderItemsData = await db
      .select({
        productId: orderItems.productId,
        variantId: orderItems.variantId,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    for (const item of orderItemsData) {
      if (item.variantId) {
        // Restaurar stock de variante
        await db
          .update(productVariants)
          .set({
            stock: sql`${productVariants.stock} + ${item.quantity}`,
          })
          .where(eq(productVariants.id, item.variantId));
      } else {
        // Restaurar stock del producto principal
        await db
          .update(products)
          .set({
            stock: sql`${products.stock} + ${item.quantity}`,
          })
          .where(eq(products.id, item.productId));
      }
    }

    revalidatePath(`/orders/${orderId}`);
    revalidatePath('/orders');
    revalidatePath('/admin/orders');

    return updatedOrder || null;
  } catch (error) {
    console.error('Error cancelling order:', error);
    throw error;
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

// ======================
// Funciones para Mercado Libre
// ======================

// Importar órdenes desde Mercado Libre
export async function importOrdersFromMercadoLibre(
  userId: number,
  limit: number = 50
): Promise<{ success: boolean; imported: number; error?: string }> {
  try {
    // Obtener órdenes recientes de ML
    const response = await makeAuthenticatedRequest(
      userId,
      `/orders/search?seller=${userId}&limit=${limit}&sort=date_desc`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error obteniendo órdenes de ML: ${error}`);
    }

    const mlOrdersResponse = await response.json();
    const mlOrders = mlOrdersResponse.results || [];

    let importedCount = 0;

    for (const mlOrder of mlOrders) {
      try {
        // Verificar si ya fue importada
        const existingImport = await db.query.mercadolibreOrdersImport.findFirst({
          where: eq(mercadolibreOrdersImport.mlOrderId, mlOrder.id.toString()),
        });

        if (existingImport) {
          continue; // Ya fue importada
        }

        // Crear orden local
        const newOrder = await db.insert(orders).values({
          userId,
          total: mlOrder.total_amount.toString(),
          status: mapMLStatusToLocal(mlOrder.status) as 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'rejected',
          mlOrderId: mlOrder.id.toString(),
          source: 'mercadolibre',
          mlStatus: mlOrder.status,
          mlBuyerInfo: JSON.stringify(mlOrder.buyer),
          mlShippingInfo: JSON.stringify(mlOrder.shipping),
          mlPaymentInfo: JSON.stringify(mlOrder.payments),
          createdAt: new Date(mlOrder.date_created),
          updatedAt: new Date(),
        }).returning({ id: orders.id });

        const orderId = newOrder[0].id;

        // Crear items de la orden
        if (mlOrder.order_items && mlOrder.order_items.length > 0) {
          const orderItemsData = [];

          for (const mlItem of mlOrder.order_items) {
            // Buscar producto local por ML item ID
            const localProduct = await db.query.products.findFirst({
              where: eq(products.mlItemId, mlItem.item.id.toString()),
            });

            if (localProduct) {
              orderItemsData.push({
                orderId,
                productId: localProduct.id,
                quantity: mlItem.quantity,
                price: mlItem.unit_price.toString(),
              });
            }
          }

          if (orderItemsData.length > 0) {
            await db.insert(orderItems).values(orderItemsData);
          }
        }

        // Crear registro de importación
        await db.insert(mercadolibreOrdersImport).values({
          orderId,
          mlOrderId: mlOrder.id.toString(),
          importStatus: 'imported',
          importedAt: new Date(),
          mlOrderData: mlOrder,
        });

        importedCount++;

      } catch (itemError) {
        console.error(`Error importando orden ${mlOrder.id}:`, itemError);
        
        // Omitir guardar registro de error ya que orderId es requerido y no tenemos una orden local
        // El error ya está siendo logueado arriba
      }
    }

    return { success: true, imported: importedCount };

  } catch (error) {
    console.error('Error importando órdenes de ML:', error);
    return { 
      success: false, 
      imported: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Mapear estados de ML a locales
function mapMLStatusToLocal(mlStatus: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'pending',
    'paid': 'paid',
    'cancelled': 'cancelled',
    'confirmed': 'paid',
    'payment_required': 'pending',
    'payment_in_process': 'pending',
    'partially_paid': 'paid',
    'rejected': 'rejected',
    'refunded': 'cancelled',
    'in_mediation': 'pending',
    'invalid': 'rejected',
  };

  return statusMap[mlStatus] || 'pending';
}

// Obtener órdenes pendientes de importación
export async function getPendingImportOrders() {
  return await db.query.mercadolibreOrdersImport.findMany({
    where: eq(mercadolibreOrdersImport.importStatus, 'pending'),
    orderBy: desc(mercadolibreOrdersImport.createdAt),
  });
}
