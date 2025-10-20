import { auth } from '@/lib/actions/auth'; // ✅ Importar la función auth
import { db } from '@/lib/db';
import { orders, orderItems, products } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger'; // ✅ Importar el logger

export async function GET(request: Request) {
  try {
    const session = await auth(); // ✅ Usar la función auth para obtener la sesión

    if (!session?.user?.id) {
      logger.warn('Intento de acceso no autorizado a /api/orders', { ip: request.headers.get('x-forwarded-for') });
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }

    logger.info('Obteniendo órdenes para el usuario', { userId: session.user.id });

    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, parseInt(session.user.id)))
      .orderBy(desc(orders.createdAt));

    const ordersWithItems = await Promise.all(
      userOrders.map(async (order) => {
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
          .where(eq(orderItems.orderId, order.id));

        const total = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

        return { ...order, items, total };
      })
    );

    logger.info('Órdenes obtenidas exitosamente', { userId: session.user.id, orderCount: ordersWithItems.length });

    return new Response(JSON.stringify(ordersWithItems), { status: 200 });
  } catch (error) {
    logger.error('Error al obtener órdenes', { error });
    return new Response(JSON.stringify({ error: 'Error al obtener el historial de compras' }), { status: 500 });
  }
}
