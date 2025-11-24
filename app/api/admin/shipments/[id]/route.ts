import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, shipmentHistory, orderItems, products } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';

// Verificación temporal para testing - en producción usar auth real
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  // Para testing, permitir llamadas con header específico o desde localhost
  const isAdmin = request.headers.get('x-admin-request') === 'true';
  const authHeader = request.headers.get('authorization');
  const isLocalhost = request.headers.get('host')?.includes('localhost') || false;
  
  return isAdmin || authHeader?.startsWith('Bearer admin-') || isLocalhost;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar permisos de administrador
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'No autorizado - se requieren permisos de administrador' },
        { status: 401 }
      );
    }

    const { id: shipmentId } = await params;

    if (!shipmentId) {
      return NextResponse.json(
        { error: 'ID de shipment es requerido' },
        { status: 400 }
      );
    }

    // Obtener datos principales del shipment
    const shipmentData = await db
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
        total: orders.total,
        shippingAddress: orders.shippingAddress
      })
      .from(orders)
      .where(eq(orders.mercadoLibreShipmentId, shipmentId))
      .limit(1);

    if (shipmentData.length === 0) {
      return NextResponse.json(
        { error: 'Shipment no encontrado' },
        { status: 404 }
      );
    }

    const shipment = shipmentData[0];

    // Obtener items de la orden con información de productos
    const orderItemsData = await db
      .select({
        name: products.name,
        quantity: orderItems.quantity,
        price: orderItems.price,
        height: products.height,
        width: products.width,
        length: products.length,
        weight: products.weight
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, shipment.orderId));

    // Formatear items con dimensiones
    const formattedItems = orderItemsData.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price.toString(),
      dimensions: item.height && item.width && item.length 
        ? `${item.height}x${item.width}x${item.length}cm, ${item.weight}kg`
        : 'Dimensiones no disponibles'
    }));

    // Obtener historial completo del shipment
    const historyData = await db
      .select({
        status: shipmentHistory.status,
        substatus: shipmentHistory.substatus,
        dateCreated: shipmentHistory.dateCreated,
        trackingNumber: shipmentHistory.trackingNumber,
        comment: shipmentHistory.comment,
        source: shipmentHistory.source
      })
      .from(shipmentHistory)
      .where(eq(shipmentHistory.orderId, shipment.orderId))
      .orderBy(desc(shipmentHistory.dateCreated));

    const response = {
      success: true,
      shipment: {
        ...shipment,
        total: shipment.total.toString(),
        orderData: {
          shippingAddress: shipment.shippingAddress,
          items: formattedItems
        },
        history: historyData.map(event => ({
          ...event,
          dateCreated: event.dateCreated.toISOString()
        }))
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error en API de detalle de shipment:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

// Endpoint para generar etiqueta de envío (placeholder)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id: shipmentId } = await params;

    // TODO: Implementar generación real de etiqueta con API de Mercado Libre
    // Por ahora, devolver una respuesta placeholder
    
    return NextResponse.json({
      success: true,
      message: 'Función de generación de etiquetas no implementada aún',
      shipmentId,
      note: 'Integrar con API de etiquetas de Mercado Libre cuando esté disponible'
    });

  } catch (error) {
    console.error('❌ Error generando etiqueta:', error);
    
    return NextResponse.json(
      { 
        error: 'Error generando etiqueta',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
