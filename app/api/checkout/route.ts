import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { orders, orderItems } from '@/lib/schema';
import { eq } from 'drizzle-orm';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    const { items } = await request.json();

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

    // Calcular total
    const total = items.reduce((acc: number, item: any) => {
      const finalPrice = item.discount && item.discount > 0
        ? item.price * (1 - item.discount / 100)
        : item.price;
      return acc + finalPrice * item.quantity;
    }, 0);

    // Crear orden en la base de datos
    const orderResult = await db
      .insert(orders)
      .values({
        userId: parseInt(session.user.id),
        total: total.toString(),
        status: 'pending',
      })
      .returning();

    const order = orderResult[0];

    // Insertar items de la orden
    await db.insert(orderItems).values(
      items.map((item: any) => ({
        orderId: order.id,
        productId: item.id,
        quantity: item.quantity,
        price: (item.discount && item.discount > 0
          ? item.price * (1 - item.discount / 100)
          : item.price).toString(),
      }))
    );

    // Crear preferencia de Mercado Pago
    const preference = new Preference(client);

    const preferenceData = {
      items: items.map((item: any) => ({
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
    console.error('Error creando preferencia de pago:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
