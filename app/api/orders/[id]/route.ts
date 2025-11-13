import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { orders, orderItems, products, productVariants } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;

  try {
    // Verificar rate limiting
    const rateLimitResponse = checkRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    if (!orderId || isNaN(parseInt(orderId))) {
      return NextResponse.json(
        { error: 'ID de orden inválido' },
        { status: 400 }
      );
    }

    const orderIdNum = parseInt(orderId);

    // Obtener la orden con items
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
      })
      .from(orders)
      .where(eq(orders.id, orderIdNum))
      .limit(1);

    if (orderData.length === 0) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    const order = orderData[0];

    // Verificar que la orden pertenece al usuario actual
    if (order.userId !== parseInt(session.user.id)) {
      logger.warn('Intento de acceso no autorizado a orden', {
        orderId,
        userId: session.user.id,
        orderUserId: order.userId
      });
      return NextResponse.json(
        { error: 'No tienes permisos para ver esta orden' },
        { status: 403 }
      );
    }

    // Obtener los items de la orden
    const items = await db
      .select({
        id: orderItems.id,
        quantity: orderItems.quantity,
        price: orderItems.price,
        productId: orderItems.productId,
        variantId: orderItems.variantId,
        productName: products.name,
        productImage: products.image,
        productAttributes: products.attributes,
        variantName: productVariants.name,
        variantImage: productVariants.images,
        variantAttributes: productVariants.additionalAttributes,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
      .where(eq(orderItems.orderId, orderIdNum));

    const orderWithItems = {
      ...order,
      total: Number(order.total),
      shippingCost: Number(order.shippingCost),
      items: items.map(item => ({
        id: item.id.toString(),
        quantity: item.quantity,
        price: Number(item.price),
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName || 'Producto desconocido',
        productImage: item.productImage,
        productAttributes: item.productAttributes,
        variantName: item.variantName,
        variantImage: item.variantImage,
        variantAttributes: item.variantAttributes,
      })),
    };

    return NextResponse.json(orderWithItems);

  } catch (error) {
    logger.error('Error obteniendo orden detallada', {
      error: error instanceof Error ? error.message : String(error),
      orderId
    });
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
