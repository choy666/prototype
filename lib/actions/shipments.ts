import { db } from '@/lib/db';
import { orders, orderItems, products, addresses, mlShippingModes } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { 
  MLShipment, 
  MLShippingCalculateRequest, 
  MLShippingCalculateResponse,
  MLShipmentCreateRequest,
  MLShipmentTracking,
  ML_STATUS_TO_LOCAL,
  LocalShipmentStatus
} from '@/types/mercadolibre';
import { MercadoLibreAuth } from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';
import { getApiUrl } from '@/lib/config/integrations';

/**
 * Calcula el costo de envío usando la API de Mercado Libre
 */
export async function calculateMLShippingCost(
  zipcode: string,
  items: Array<{ id: string; quantity: number; price: number }>,
  sellerAddressId?: string,
  logisticType: string = 'drop_off'
): Promise<MLShippingCalculateResponse> {
  try {
    const auth = await MercadoLibreAuth.getInstance();
    const accessToken = await auth.getAccessToken();
    
    if (!accessToken) {
      throw new Error('No se encontró token de acceso a Mercado Libre');
    }

    // Para Argentina, usamos el primer item para calcular (ML API funciona por item)
    const firstItem = items[0];
    if (!firstItem) {
      throw new Error('Se requiere al menos un item para calcular envío');
    }

    // Obtener datos del producto para dimensiones
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, parseInt(firstItem.id)))
      .limit(1);

    if (!product.length) {
      throw new Error(`Producto no encontrado: ${firstItem.id}`);
    }

    // Verificar dimensiones y loggear advertencias si faltan
    const hasInvalidDimensions = !product[0].height || !product[0].width || !product[0].length || 
                                Number(product[0].height) === 0 || Number(product[0].width) === 0 || Number(product[0].length) === 0;
    
    if (hasInvalidDimensions) {
      logger.warn('Product has invalid dimensions, using defaults', {
        productId: firstItem.id,
        height: product[0].height,
        width: product[0].width,
        length: product[0].length,
        weight: product[0].weight
      });
    }

    const dimensions = {
      height: Number(product[0].height) || 10,
      width: Number(product[0].width) || 10,
      length: Number(product[0].length) || 10,
      weight: Number(product[0].weight) || 0.5
    };

    const requestBody: MLShippingCalculateRequest = {
      zipcode,
      item_id: firstItem.id,
      quantity: firstItem.quantity,
      dimensions,
      seller_address: sellerAddressId,
      local_pickup: false, // Configuración por defecto para envíos a domicilio
      logistic_type: logisticType
    };

    const response = await fetch(
      getApiUrl('mercadolibre', '/shipping_options/{item_id}', {
        item_id: firstItem.id
      }),
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('Error calculating ML shipping cost', { 
        status: response.status, 
        error,
        requestBody 
      });
      throw new Error(`Error ${response.status}: ${error}`);
    }

    const data: MLShippingCalculateResponse = await response.json();
    logger.info('ML shipping cost calculated successfully', { 
      zipcode, 
      items: items.length,
      methods: data.methods.length 
    });

    return data;
  } catch (error) {
    logger.error('Failed to calculate ML shipping cost', error);
    throw error;
  }
}

/**
 * Crea un shipment en Mercado Libre para una orden
 */
export async function createMLShipment(orderId: string): Promise<MLShipment> {
  try {
    // Obtener datos de la orden
    const orderData = await db
      .select({
        order: orders,
        items: orderItems,
        product: products,
        address: addresses
      })
      .from(orders)
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .leftJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(addresses, eq(orders.shippingAddressId, addresses.id))
      .where(eq(orders.id, parseInt(orderId)));

    if (!orderData.length) {
      throw new Error(`Orden no encontrada: ${orderId}`);
    }

    const order = orderData[0].order;
    const address = orderData[0].address;
    
    if (!address) {
      throw new Error('La orden no tiene dirección de envío');
    }

    // Agrupar items por producto
    const itemsMap = new Map();
    orderData.forEach(row => {
      if (row.items && row.product) {
        const key = row.product.id.toString();
        if (!itemsMap.has(key)) {
          itemsMap.set(key, {
            id: row.product.id.toString(),
            description: row.product.name,
            quantity: 0,
            dimensions: {
              height: Number(row.product.height) || 10,
              width: Number(row.product.width) || 10,
              length: Number(row.product.length) || 10,
              weight: Number(row.product.weight) || 0.5
            }
          });
        }
        itemsMap.get(key).quantity += row.items.quantity;
      }
    });

    const shippingItems = Array.from(itemsMap.values());

    // Obtener dirección del vendedor (configurada en ML)
    const auth = await MercadoLibreAuth.getInstance();
    const accessToken = await auth.getAccessToken();

    // Obtener direcciones del vendedor en ML
    const sellerResponse = await fetch(
      getApiUrl('mercadolibre', '/users/me/addresses'),
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    );

    if (!sellerResponse.ok) {
      throw new Error('Error obteniendo direcciones del vendedor');
    }

    const sellerAddresses = await sellerResponse.json();
    const sellerAddress = sellerAddresses.find((addr: { is_default?: boolean }) => addr.is_default) || sellerAddresses[0];

    if (!sellerAddress) {
      throw new Error('No se encontró dirección del vendedor');
    }

    // Crear shipment request
    const shipmentRequest: MLShipmentCreateRequest = {
      order_id: orderId,
      mode: 'me2', // Mercado Envíos 2
      shipping_method: 733, // Estándar a domicilio
      sender_address_id: sellerAddress.id.toString(),
      receiver_address_id: order.mercadoLibreAddressId || address.id.toString(),
      shipping_items: shippingItems,
      comment: `Envío orden ${orderId}`,
      tags: ['marketplace_place']
    };

    const response = await fetch(
      getApiUrl('mercadolibre', '/shipments'),
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shipmentRequest)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('Error creating ML shipment', { 
        orderId, 
        status: response.status, 
        error,
        request: shipmentRequest 
      });
      throw new Error(`Error ${response.status}: ${error}`);
    }

    const shipment: MLShipment = await response.json();
    
    // Actualizar orden con datos del shipment
    await db
      .update(orders)
      .set({
        mercadoLibreShipmentId: shipment.id,
        trackingNumber: shipment.tracking_number,
        trackingUrl: shipment.tracking_url,
        shippingStatus: mapMLStatusToLocal(shipment.status),
        updatedAt: new Date()
      })
      .where(eq(orders.id, parseInt(orderId)));

    logger.info('ML shipment created successfully', { 
      orderId, 
      shipmentId: shipment.id,
      trackingNumber: shipment.tracking_number 
    });

    return shipment;
  } catch (error) {
    logger.error('Failed to create ML shipment', error);
    throw error;
  }
}

/**
 * Obtiene el tracking de un shipment de Mercado Libre
 */
export async function getMLShipmentTracking(shipmentId: string): Promise<MLShipmentTracking> {
  try {
    const auth = await MercadoLibreAuth.getInstance();
    const accessToken = await auth.getAccessToken();

    const response = await fetch(
      getApiUrl('mercadolibre', '/shipments/{shipment_id}/tracking', {
        shipment_id: shipmentId
      }),
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('Error getting ML shipment tracking', { 
        shipmentId, 
        status: response.status, 
        error 
      });
      throw new Error(`Error ${response.status}: ${error}`);
    }

    const tracking: MLShipmentTracking = await response.json();
    
    // Actualizar estado en la base de datos local
    const localStatus = mapMLStatusToLocal(tracking.status);
    
    await db
      .update(orders)
      .set({
        shippingStatus: localStatus,
        trackingNumber: tracking.tracking_number,
        trackingUrl: tracking.tracking_url,
        updatedAt: new Date()
      })
      .where(eq(orders.mercadoLibreShipmentId, shipmentId));

    logger.info('ML shipment tracking updated', { 
      shipmentId, 
      status: tracking.status,
      localStatus 
    });

    return tracking;
  } catch (error) {
    logger.error('Failed to get ML shipment tracking', error);
    throw error;
  }
}

/**
 * Sincroniza el estado de todos los shipments pendientes
 */
export async function syncPendingShipments(): Promise<void> {
  try {
    // Obtener órdenes con shipments ML pendientes
    const pendingOrders = await db
      .select({
        id: orders.id,
        mercadoLibreShipmentId: orders.mercadoLibreShipmentId,
        shippingStatus: orders.shippingStatus
      })
      .from(orders)
      .where(
        and(
          eq(orders.mercadoLibreShipmentId, orders.mercadoLibreShipmentId), // No es null
          eq(orders.shippingStatus, 'pending')
        )
      );

    logger.info('Syncing pending shipments', { count: pendingOrders.length });

    for (const order of pendingOrders) {
      if (order.mercadoLibreShipmentId) {
        try {
          await getMLShipmentTracking(order.mercadoLibreShipmentId);
        } catch (error) {
          logger.error(`Failed to sync shipment ${order.mercadoLibreShipmentId}`, error);
        }
      }
    }

    logger.info('Pending shipments sync completed');
  } catch (error) {
    logger.error('Failed to sync pending shipments', error);
    throw error;
  }
}

/**
 * Cancela un shipment en Mercado Libre
 */
export async function cancelMLShipment(shipmentId: string, reason: string = 'buyer_request'): Promise<void> {
  try {
    const auth = await MercadoLibreAuth.getInstance();
    const accessToken = await auth.getAccessToken();

    const response = await fetch(
      `https://api.mercadolibre.com/shipments/${shipmentId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('Error cancelling ML shipment', { 
        shipmentId, 
        status: response.status, 
        error 
      });
      throw new Error(`Error ${response.status}: ${error}`);
    }

    // Actualizar estado local
    await db
      .update(orders)
      .set({
        shippingStatus: 'cancelled',
        updatedAt: new Date()
      })
      .where(eq(orders.mercadoLibreShipmentId, shipmentId));

    logger.info('ML shipment cancelled successfully', { shipmentId, reason });
  } catch (error) {
    logger.error('Failed to cancel ML shipment', error);
    throw error;
  }
}

/**
 * Obtiene los modos de envío disponibles de Mercado Libre
 */
export async function getMLShippingModes(): Promise<Array<{ id: string; name: string; description: string }>> {
  try {
    const modes = await db
      .select()
      .from(mlShippingModes)
      .where(eq(mlShippingModes.isActive, true));

    return modes.map(mode => ({
      id: mode.mlModeId,
      name: mode.name,
      description: mode.description || ''
    }));
  } catch (error) {
    logger.error('Failed to get ML shipping modes', error);
    throw error;
  }
}

/**
 * Mapea el estado de ML a estado local
 */
function mapMLStatusToLocal(mlStatus: string): LocalShipmentStatus {
  return ML_STATUS_TO_LOCAL[mlStatus as keyof typeof ML_STATUS_TO_LOCAL] || 'pending';
}

/**
 * Obtiene detalles completos de un shipment
 */
export async function getMLShipmentDetails(shipmentId: string): Promise<MLShipment> {
  try {
    const auth = await MercadoLibreAuth.getInstance();
    const accessToken = await auth.getAccessToken();

    const response = await fetch(
      `https://api.mercadolibre.com/shipments/${shipmentId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('Error getting ML shipment details', { 
        shipmentId, 
        status: response.status, 
        error 
      });
      throw new Error(`Error ${response.status}: ${error}`);
    }

    const shipment: MLShipment = await response.json();
    
    // Actualizar estado local
    await db
      .update(orders)
      .set({
        shippingStatus: mapMLStatusToLocal(shipment.status),
        trackingNumber: shipment.tracking_number,
        trackingUrl: shipment.tracking_url,
        updatedAt: new Date()
      })
      .where(eq(orders.mercadoLibreShipmentId, shipmentId));

    return shipment;
  } catch (error) {
    logger.error('Failed to get ML shipment details', error);
    throw error;
  }
}

/**
 * Imprime etiqueta de envío
 */
export async function printMLShipmentLabel(shipmentId: string): Promise<string> {
  try {
    const auth = await MercadoLibreAuth.getInstance();
    const accessToken = await auth.getAccessToken();

    const response = await fetch(
      `https://api.mercadolibre.com/shipments/${shipmentId}/labels`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('Error printing ML shipment label', { 
        shipmentId, 
        status: response.status, 
        error 
      });
      throw new Error(`Error ${response.status}: ${error}`);
    }

    const labelData = await response.json();
    
    // Actualizar estado a impreso
    await db
      .update(orders)
      .set({
        shippingStatus: 'processing',
        updatedAt: new Date()
      })
      .where(eq(orders.mercadoLibreShipmentId, shipmentId));

    logger.info('ML shipment label printed successfully', { shipmentId });
    
    return labelData.content; // Base64 del PDF
  } catch (error) {
    logger.error('Failed to print ML shipment label', error);
    throw error;
  }
}
