// app/api/checkout/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { orders } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { MercadoPagoConfig, Payment } from 'mercadopago'

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { type, data } = body

    if (type !== 'payment') {
      return NextResponse.json({ message: 'Evento ignorado' }, { status: 200 })
    }

    const paymentClient = new Payment(mpClient)
    const payment = await paymentClient.get({ id: data.id })

    if (!payment) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
    }

    const { status, external_reference } = payment

    if (!external_reference) {
      console.warn('Webhook recibido sin external_reference', payment)
      return NextResponse.json({ error: 'Referencia externa faltante' }, { status: 400 })
    }

    const orderId = parseInt(external_reference, 10)
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'external_reference inválido' }, { status: 400 })
    }

    let newStatus: 'pending' | 'paid' | 'failed' = 'pending'
    if (status === 'approved') newStatus = 'paid'
    else if (status === 'rejected' || status === 'cancelled') newStatus = 'failed'

    await db.update(orders)
      .set({ status: newStatus })
      .where(eq(orders.id, orderId))

    return NextResponse.json({ message: 'Orden actualizada', orderId, newStatus })
  } catch (error) {
    console.error('Error en webhook MP:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 200 })
  }
}
