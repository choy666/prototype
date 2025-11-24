import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, shipmentHistory } from '@/lib/schema';
import { desc, eq, and, isNotNull, sql } from 'drizzle-orm';

// Verificación temporal para testing - en producción usar auth real
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  // Para testing, permitir llamadas con header específico o desde localhost
  const isAdmin = request.headers.get('x-admin-request') === 'true';
  const authHeader = request.headers.get('authorization');
  const isLocalhost = request.headers.get('host')?.includes('localhost') || false;
  
  return isAdmin || authHeader?.startsWith('Bearer admin-') || isLocalhost;
}

export async function GET(request: NextRequest) {
  try {
    // Verificar permisos de administrador
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'No autorizado - se requieren permisos de administrador' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const shippingMode = searchParams.get('shippingMode');
    const search = searchParams.get('search');

    const offset = (page - 1) * limit;

    // Construir condiciones de filtrado
    const conditions = [];
    
    if (status && status !== 'all') {
      conditions.push(sql`${orders.shippingStatus} = ${status}`);
    }
    
    if (shippingMode && shippingMode !== 'all') {
      conditions.push(eq(orders.shippingMode, shippingMode));
    }
    
    if (search) {
      // Búsqueda por shipment ID, order ID o email
      conditions.push(
        sql`
          (
            ${orders.mercadoLibreShipmentId} ILIKE ${'%' + search + '%'} OR
            ${orders.id}::text ILIKE ${'%' + search + '%'} OR
            ${orders.email} ILIKE ${'%' + search + '%'} OR
            ${orders.trackingNumber} ILIKE ${'%' + search + '%'}
          )
        `
      );
    }

    // Solo incluir órdenes con shipment de Mercado Libre
    const whereCondition = conditions.length > 0 
      ? and(isNotNull(orders.mercadoLibreShipmentId), ...conditions)
      : isNotNull(orders.mercadoLibreShipmentId);

    // Obtener shipments con paginación
    const shipmentsData = await db
      .select({
        id: orders.mercadoLibreShipmentId,
        orderId: orders.id,
        orderEmail: orders.email,
        status: orders.shippingStatus,
        substatus: orders.mercadoLibreShipmentSubstatus,
        trackingNumber: orders.trackingNumber,
        trackingUrl: orders.trackingUrl,
        shippingMode: orders.shippingMode,
        mercadoLibreShipmentStatus: orders.mercadoLibreShipmentStatus,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        total: orders.total
      })
      .from(orders)
      .where(whereCondition)
      .orderBy(desc(orders.updatedAt))
      .limit(limit)
      .offset(offset);

    // Obtener conteo total para paginación
    const totalCountQuery = await db
      .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
      .from(orders)
      .where(whereCondition);

    const totalCount = totalCountQuery[0].count;

    // Obtener historial para cada shipment (últimos 5 cambios)
    const shipmentsWithHistory = await Promise.all(
      shipmentsData.map(async (shipment) => {
        const history = await db
          .select({
            status: shipmentHistory.status,
            substatus: shipmentHistory.substatus,
            dateCreated: shipmentHistory.dateCreated,
            trackingNumber: shipmentHistory.trackingNumber,
            comment: shipmentHistory.comment
          })
          .from(shipmentHistory)
          .where(eq(shipmentHistory.orderId, shipment.orderId))
          .orderBy(desc(shipmentHistory.dateCreated))
          .limit(5);

        return {
          ...shipment,
          history
        };
      })
    );

    // Calcular estadísticas
    const statsQuery = await db
      .select({
        total: sql<number>`COUNT(*)`.mapWith(Number),
        pending: sql<number>`COUNT(CASE WHEN ${orders.shippingStatus} = 'pending' THEN 1 END)`.mapWith(Number),
        processing: sql<number>`COUNT(CASE WHEN ${orders.shippingStatus} = 'processing' THEN 1 END)`.mapWith(Number),
        shipped: sql<number>`COUNT(CASE WHEN ${orders.shippingStatus} = 'shipped' THEN 1 END)`.mapWith(Number),
        delivered: sql<number>`COUNT(CASE WHEN ${orders.shippingStatus} = 'delivered' THEN 1 END)`.mapWith(Number),
        cancelled: sql<number>`COUNT(CASE WHEN ${orders.shippingStatus} = 'cancelled' THEN 1 END)`.mapWith(Number),
        returned: sql<number>`COUNT(CASE WHEN ${orders.shippingStatus} = 'returned' THEN 1 END)`.mapWith(Number),
        me2: sql<number>`COUNT(CASE WHEN ${orders.shippingMode} = 'me2' THEN 1 END)`.mapWith(Number),
        me1: sql<number>`COUNT(CASE WHEN ${orders.shippingMode} = 'me1' THEN 1 END)`.mapWith(Number),
        custom: sql<number>`COUNT(CASE WHEN ${orders.shippingMode} = 'custom' THEN 1 END)`.mapWith(Number)
      })
      .from(orders)
      .where(isNotNull(orders.mercadoLibreShipmentId));

    const stats = statsQuery[0];

    const response = {
      success: true,
      shipments: shipmentsWithHistory,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      },
      stats: {
        total: stats.total,
        byStatus: {
          pending: stats.pending,
          processing: stats.processing,
          shipped: stats.shipped,
          delivered: stats.delivered,
          cancelled: stats.cancelled,
          returned: stats.returned
        },
        byShippingMode: {
          me2: stats.me2,
          me1: stats.me1,
          custom: stats.custom
        }
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error en API de admin shipments:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

// Endpoint para actualizar manualmente un shipment (admin)
export async function PUT(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { shipmentId, status, comment } = body;

    if (!shipmentId || !status) {
      return NextResponse.json(
        { error: 'shipmentId y status son requeridos' },
        { status: 400 }
      );
    }

    // Actualizar orden
    const updateResult = await db
      .update(orders)
      .set({
        shippingStatus: status,
        updatedAt: new Date()
      })
      .where(eq(orders.mercadoLibreShipmentId, shipmentId))
      .returning({ id: orders.id });

    if (updateResult.length === 0) {
      return NextResponse.json(
        { error: 'Shipment no encontrado' },
        { status: 404 }
      );
    }

    // Agregar al historial
    await db.insert(shipmentHistory).values({
      orderId: updateResult[0].id,
      shipmentId,
      status,
      comment: comment || 'Actualización manual por administrador',
      dateCreated: new Date(),
      source: 'admin',
      createdAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Shipment actualizado exitosamente',
      shipmentId,
      status
    });

  } catch (error) {
    console.error('❌ Error actualizando shipment:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
