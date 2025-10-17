import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { orders, orderItems, products } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/utils/logger';

interface CartItem {
  id: number;
  name: string;
  price: number;
  discount: number;
  quantity: number;
}

interface DbProduct {
  id: number;
  name: string;
  price: string;
  discount: number;
  stock: number;
}

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
});

export async function POST(request: NextRequest) {
  let session: any = null;
  let items: CartItem[] = [];

  try {
    // Verificar rate limiting
    const rateLimitResponse = checkRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    const { items }: { items: CartItem[] } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No hay items en el carrito' },
        { status: 400 }
      );
    }

    // Validaciones de seguridad adicionales
    if (items.length > 50) {
      return NextResponse.json(
        { error: 'Demasiados items en el carrito' },
        { status: 400 }
      );
    }

    // Validar estructura de cada item
    for (const item of items) {
      if (!item.id || typeof item.id !== 'number' || item.id <= 0) {
        return NextResponse.json(
          { error: 'ID de producto inválido' },
          { status: 400 }
        );
      }

      if (!item.name || typeof item.name !== 'string' || item.name.length > 255) {
        return NextResponse.json(
          { error: 'Nombre de producto inválido' },
          { status: 400 }
        );
      }

      if (typeof item.price !== 'number' || item.price < 0 || item.price > 999999) {
        return NextResponse.json(
          { error: 'Precio inválido' },
          { status: 400 }
        );
      }

      if (typeof item.discount !== 'number' || item.discount < 0 || item.discount > 100) {
        return NextResponse.json(
          { error: 'Descuento inválido' },
          { status: 400 }
        );
      }

      if (!item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0 || item.quantity > 99) {
        return NextResponse.json(
          { error: 'Cantidad inválida' },
          { status: 400 }
        );
      }
    }

    // Validar precios y stock contra la base de datos
    const productIds = items.map((item: CartItem) => item.id);
    const productsFromDb = await db
      .select({
        id: products.id,
        name: products.name,
        price: products.price,
        discount: products.discount,
        stock: products.stock,
      })
      .from(products)
      .where(sql`${products.id} IN (${productIds.join(',')})`);

    // Verificar que todos los productos existen
    if (productsFromDb.length !== items.length) {
      const foundIds = productsFromDb.map((p: DbProduct) => p.id);
      const missingIds = productIds.filter((id: number) => !foundIds.includes(id));
      logger.warn('Productos no encontrados en checkout', { missingIds, totalItems: items.length });
      return NextResponse.json(
        { error: 'Uno o más productos no existen' },
        { status: 400 }
      );
    }

    // Crear mapa de productos para validación rápida
    const productMap = new Map(productsFromDb.map(p => [p.id, p]));

    // Validar precios, descuentos y stock
    const validationErrors: string[] = [];
    for (const item of items) {
      const dbProduct = productMap.get(item.id);
      if (!dbProduct) continue;

      // Validar precio
      const dbPrice = parseFloat(dbProduct.price);
      if (Math.abs(item.price - dbPrice) > 0.01) { // Tolerancia de 1 centavo
        validationErrors.push(
          `Precio manipulado para ${dbProduct.name}: cliente=${item.price}, BD=${dbPrice}`
        );
        logger.warn('Precio manipulado detectado', {
          productId: item.id,
          productName: dbProduct.name,
          clientPrice: item.price,
          dbPrice: dbPrice
        });
      }

      // Validar descuento
      if (item.discount !== dbProduct.discount) {
        validationErrors.push(
          `Descuento manipulado para ${dbProduct.name}: cliente=${item.discount}%, BD=${dbProduct.discount}%`
        );
        logger.warn('Descuento manipulado detectado', {
          productId: item.id,
          productName: dbProduct.name,
          clientDiscount: item.discount,
          dbDiscount: dbProduct.discount
        });
      }

      // Validar stock
      if (item.quantity > dbProduct.stock) {
        validationErrors.push(
          `Stock insuficiente para ${dbProduct.name}: solicitado=${item.quantity}, disponible=${dbProduct.stock}`
        );
        logger.warn('Stock insuficiente detectado', {
          productId: item.id,
          productName: dbProduct.name,
          requestedQuantity: item.quantity,
          availableStock: dbProduct.stock
        });
      }
    }

    // Si hay errores de validación, rechazar la orden
    if (validationErrors.length > 0) {
      logger.warn('Validación de checkout fallida', {
        validationErrors,
        itemCount: items.length,
        userId: session.user.id
      });
      return NextResponse.json(
        {
          error: 'Datos de productos inválidos',
          details: validationErrors
        },
        { status: 400 }
      );
    }

    // Calcular total
    const total = items.reduce((acc: number, item: CartItem) => {
      const finalPrice = item.discount && item.discount > 0
        ? item.price * (1 - item.discount / 100)
        : item.price;
      return acc + finalPrice * item.quantity;
    }, 0);

    // Usar transacción para asegurar atomicidad: crear orden, items y reservar stock
    const order = await db.transaction(async (tx) => {
      // Crear orden en la base de datos
      const orderResult = await tx
        .insert(orders)
        .values({
          userId: parseInt(session.user.id),
          total: total.toString(),
          status: 'pending',
        })
        .returning();

      const order = orderResult[0];

      // Insertar items de la orden
      await tx.insert(orderItems).values(
        items.map((item: CartItem) => ({
          orderId: order.id,
          productId: item.id,
          quantity: item.quantity,
          price: (item.discount && item.discount > 0
            ? item.price * (1 - item.discount / 100)
            : item.price).toString(),
        }))
      );

      // Reservar stock: disminuir stock de productos
      for (const item of items) {
        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${item.quantity}`,
            updated_at: new Date(),
          })
          .where(eq(products.id, item.id));
      }

      logger.info('Stock reservado para orden', {
        orderId: order.id,
        itemCount: items.length,
        totalStockReserved: items.reduce((sum, item) => sum + item.quantity, 0)
      });

      return order;
    });

    // Crear preferencia de Mercado Pago
    const preference = new Preference(client);

    const preferenceData = {
      items: items.map((item: CartItem) => ({
        id: item.id.toString(),
        title: item.name,
        quantity: item.quantity,
        currency_id: 'ARS',
        unit_price: item.discount && item.discount > 0
          ? item.price * (1 - item.discount / 100)
          : item.price,
      })),
      payer: {
        email: session.user.email,
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?order_id=${order.id}`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/failure?order_id=${order.id}`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/pending?order_id=${order.id}`,
      },
      auto_return: 'approved',
      external_reference: order.id.toString(),
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
    };

    const response = await preference.create({ body: preferenceData });

    // Actualizar orden con ID de Mercado Pago
    await db
      .update(orders)
      .set({ mercadoPagoId: response.id })
      .where(eq(orders.id, order.id));

    return NextResponse.json({
      preferenceId: response.id,
      initPoint: response.init_point,
    });

  } catch (error) {
    let errorMessage = 'Error interno del servidor';
    let statusCode = 500;
    let userId: string | undefined;
    let itemCount: number | undefined;

    // Extraer variables del scope si están disponibles
    try {
      if (typeof session !== 'undefined' && session?.user?.id) {
        userId = session.user.id;
      }
      if (typeof items !== 'undefined') {
        itemCount = items.length;
      }
    } catch {
      // Variables no disponibles, usar defaults
    }

    if (error instanceof Error) {
      if (error.message.includes('stock') || error.message.includes('insuficiente')) {
        errorMessage = 'Stock insuficiente para completar la orden';
        statusCode = 400;
      } else if (error.message.includes('precio') || error.message.includes('manipulado')) {
        errorMessage = 'Los datos del carrito han sido modificados. Por favor, recarga la página.';
        statusCode = 400;
      } else if (error.message.includes('autenticación') || error.message.includes('auth')) {
        errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
        statusCode = 401;
      } else if (error.message.includes('rate limit') || error.message.includes('límite')) {
        errorMessage = 'Demasiadas solicitudes. Por favor, espera un momento.';
        statusCode = 429;
      }
    }

    logger.error('Error creando preferencia de pago', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      itemCount
    });

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
