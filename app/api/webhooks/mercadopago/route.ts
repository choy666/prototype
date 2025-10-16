import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from '@/lib/db';
import { orders } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// Configurar Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    // Logging de seguridad
    console.log(`[SECURITY] Webhook MP recibido - IP: ${ip}, User-Agent: ${userAgent}, Payment ID: ${body?.data?.id || 'unknown'}`);

    // Verificar que sea una notificación de Mercado Pago
    if (!body || !body.data || !body.data.id) {
      console.error(`[SECURITY] Datos de webhook inválidos - IP: ${ip}`);
      return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
    }

    const paymentId = body.data.id;

    // Obtener detalles del pago desde Mercado Pago
    const payment = new Payment(client);
    const paymentData = await payment.get({ id: paymentId });

    if (!paymentData) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Buscar la orden por el external_reference
    const orderId = paymentData.external_reference;
    if (!orderId) {
      return NextResponse.json({ error: 'No order reference' }, { status: 400 });
    }

    // Actualizar el estado de la orden basado en el estado del pago
    let orderStatus: 'pending' | 'paid' | 'cancelled' = 'pending';

    switch (paymentData.status) {
      case 'approved':
        orderStatus = 'paid';
        break;
      case 'cancelled':
      case 'rejected':
        orderStatus = 'cancelled';
        break;
      default:
        orderStatus = 'pending';
    }

    // Actualizar la orden en la base de datos
    await db
      .update(orders)
      .set({
        status: orderStatus,
        paymentId: paymentId.toString(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, parseInt(orderId)));

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error processing Mercado Pago webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
