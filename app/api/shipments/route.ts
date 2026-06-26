import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth/session';
import { 
  createMLShipment, 
  getMLShipmentDetails, 
  cancelMLShipment, 
  printMLShipmentLabel,
  syncPendingShipments 
} from '@/lib/actions/shipments';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

const createShipmentSchema = z.object({
  orderId: z.string().min(1, 'ID de orden requerido'),
});

const cancelShipmentSchema = z.object({
  shipmentId: z.string().min(1, 'ID de shipment requerido'),
  reason: z.string().optional().default('buyer_request'),
});

const printLabelSchema = z.object({
  shipmentId: z.string().min(1, 'ID de shipment requerido'),
});

export async function POST(request: NextRequest) {
  try {
    const session = await authOptions();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Determinar la acción basada en el cuerpo de la solicitud
    if (body.action === 'create') {
      const { orderId } = createShipmentSchema.parse(body);
      
      logger.info('Creating ML shipment', { orderId, userEmail: session.user.email });
      
      const shipment = await createMLShipment(orderId);
      
      return NextResponse.json({
        success: true,
        shipment: {
          id: shipment.id,
          status: shipment.status,
          trackingNumber: shipment.tracking_number,
          trackingUrl: shipment.tracking_url,
          cost: shipment.cost,
          estimatedDelivery: shipment.date_created
        }
      });
    }
    
    if (body.action === 'cancel') {
      const { shipmentId, reason } = cancelShipmentSchema.parse(body);
      
      logger.info('Cancelling ML shipment', { shipmentId, reason, userEmail: session.user.email });
      
      await cancelMLShipment(shipmentId, reason);
      
      return NextResponse.json({
        success: true,
        message: 'Shipment cancelado exitosamente'
      });
    }
    
    if (body.action === 'print-label') {
      const { shipmentId } = printLabelSchema.parse(body);
      
      logger.info('Printing ML shipment label', { shipmentId, userEmail: session.user.email });
      
      const labelData = await printMLShipmentLabel(shipmentId);
      
      return NextResponse.json({
        success: true,
        labelData: labelData // Base64 del PDF
      });
    }
    
    if (body.action === 'sync-pending') {
      logger.info('Syncing pending shipments', { userEmail: session.user.email });
      
      await syncPendingShipments();
      
      return NextResponse.json({
        success: true,
        message: 'Sincronización de envíos pendientes completada'
      });
    }
    
    return NextResponse.json(
      { error: 'Acción no válida' },
      { status: 400 }
    );
    
  } catch (error) {
    logger.error('Error in shipments API', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await authOptions();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const shipmentId = searchParams.get('id');
    
    if (shipmentId) {
      // Obtener detalles de un shipment específico
      logger.info('Getting ML shipment details', { shipmentId, userEmail: session.user.email });
      
      const shipment = await getMLShipmentDetails(shipmentId);
      
      return NextResponse.json({
        success: true,
        shipment: {
          id: shipment.id,
          mode: shipment.mode,
          status: shipment.status,
          substatus: shipment.substatus,
          trackingNumber: shipment.tracking_number,
          trackingUrl: shipment.tracking_url,
          cost: shipment.cost,
          currencyId: shipment.currency_id,
          dateCreated: shipment.date_created,
          lastUpdated: shipment.last_updated,
          estimatedDelivery: shipment.date_created,
          senderAddress: shipment.sender_address,
          receiverAddress: shipment.receiver_address,
          carrierInfo: shipment.carrier_info,
          logisticType: shipment.logistic_type,
          tags: shipment.tags
        }
      });
    }
    
    // Si no hay ID, devolver error
    return NextResponse.json(
      { error: 'ID de shipment requerido' },
      { status: 400 }
    );
    
  } catch (error) {
    logger.error('Error getting shipment details', error);
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
