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

    // Validar y convertir userId
    const userId = parseInt(session.user.id);
    if (isNaN(userId)) {
      logger.error('userId inválido en sesión', { sessionUserId: session.user.id });
      return new Response(JSON.stringify({ error: 'ID de usuario inválido' }), { status: 400 });
    }

    logger.info('Obteniendo órdenes para el usuario', { userId: session.user.id, parsedUserId: userId });

    let userOrders;
    try {
      userOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.userId, userId))
        .orderBy(desc(orders.createdAt));
    } catch (dbError) {
      logger.error('Error al consultar órdenes en base de datos', { error: dbError, userId });
      console.error('Error detallado en consulta de órdenes:', dbError);
      return new Response(JSON.stringify({ error: 'Error en la base de datos al obtener órdenes' }), { status: 500 });
    }

    let ordersWithItems;
    try {
      ordersWithItems = await Promise.all(
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
    } catch (itemsError) {
      logger.error('Error al obtener items de órdenes', { error: itemsError, userId });
      console.error('Error detallado en consulta de items:', itemsError);
      return new Response(JSON.stringify({ error: 'Error al procesar los items de las órdenes' }), { status: 500 });
    }

    logger.info('Órdenes obtenidas exitosamente', { userId: session.user.id, orderCount: ordersWithItems.length });

    return new Response(JSON.stringify(ordersWithItems), { status: 200 });
  } catch (error) {
    logger.error('Error general al obtener órdenes', { error });
    console.error('Error detallado general:', error);
    return new Response(JSON.stringify({ error: 'Error al obtener el historial de compras' }), { status: 500 });
  }
}
