import { NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { count, sum, sql } from 'drizzle-orm';
import { orders } from '@/lib/schema';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener estadísticas de pagos (usando mercadoPagoId como identificador)
    const [totalResult] = await db
      .select({ count: count() })
      .from(orders)
      .where(sql`mercado_pago_id IS NOT NULL`);

    const [paidResult] = await db
      .select({ count: count() })
      .from(orders)
      .where(
        sql`mercado_pago_id IS NOT NULL AND status IN ('paid', 'shipped', 'delivered')`
      );

    const [pendingResult] = await db
      .select({ count: count() })
      .from(orders)
      .where(
        sql`mercado_pago_id IS NOT NULL AND status = 'pending'`
      );

    const [failedResult] = await db
      .select({ count: count() })
      .from(orders)
      .where(
        sql`mercado_pago_id IS NOT NULL AND status IN ('cancelled', 'rejected', 'failed')`
      );

    const [amountResult] = await db
      .select({ total: sum(orders.total) })
      .from(orders)
      .where(
        sql`mercado_pago_id IS NOT NULL AND status IN ('paid', 'shipped', 'delivered')`
      );

    const stats = {
      total: totalResult.count,
      paid: paidResult.count,
      pending: pendingResult.count,
      failed: failedResult.count,
      totalAmount: Number(amountResult?.total ?? 0),
    };

    return NextResponse.json(stats);
    
  } catch (error) {
    console.error('[MP Stats] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
