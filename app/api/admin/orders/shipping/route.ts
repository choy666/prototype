// app/api/admin/orders/shipping/route.ts
// Endpoint para obtener órdenes con información de envío

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, users } from '@/lib/schema';
import { eq, and, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación de admin
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Construir where clause
    const whereConditions = [];
    
    if (status !== 'all') {
      whereConditions.push(eq(orders.shippingStatus, status as 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'failed'));
    }

    const whereClause = whereConditions.length > 0 
      ? and(...whereConditions) 
      : undefined;

    // Obtener órdenes
    const ordersList = await db
      .select({
        id: orders.id,
        customerName: users.name,
        customerEmail: users.email,
        shippingMethodId: orders.shippingMethodId,
        shippingCost: orders.shippingCost,
        shippingStatus: orders.shippingStatus,
        trackingNumber: orders.trackingNumber,
        shippingMode: orders.shippingMode,
        shippingAddress: orders.shippingAddress,
        createdAt: orders.createdAt,
        total: orders.total
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    // Obtener total para paginación
    const totalCount = await db
      .select({ count: orders.id })
      .from(orders)
      .where(whereClause);

    return NextResponse.json({
      success: true,
      orders: ordersList,
      pagination: {
        page,
        limit,
        total: totalCount.length,
        pages: Math.ceil(totalCount.length / limit)
      }
    });

  } catch (error) {
    console.error('[API] Admin shipping orders error:', error);
    return NextResponse.json(
      { error: 'Error al obtener órdenes' },
      { status: 500 }
    );
  }
}
