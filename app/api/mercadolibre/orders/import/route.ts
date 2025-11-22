import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems, products, mercadolibreOrdersImport } from '@/lib/schema';
import { eq, count } from 'drizzle-orm';
import { makeAuthenticatedRequest, isConnected } from '@/lib/auth/mercadolibre';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { logger } from '@/lib/utils/logger';
import { auth } from '@/lib/actions/auth';

interface MercadoLibreOrder {
  id: string;
  total_amount?: number;
  status: string;
  date_created: string;
  buyer?: {
    id?: string;
    nickname?: string;
  };
  shipping?: {
    shipping_option?: {
      cost?: number;
    };
    receiver_address?: {
      receiver_name?: string;
      receiver_lastname?: string;
      address_line?: string;
      city?: {
        name?: string;
      };
      state?: {
        name?: string;
      };
      postal_code?: string;
      receiver_phone?: string;
    };
  };
  payments?: Array<unknown>;
  order_items?: Array<{
    item: {
      id: string;
    };
    quantity: number;
    unit_price: number;
  }>;
}

interface OrderImportRequest {
  orderId?: string;
  importAll?: boolean;
  limit?: number;
  status?: string;
}

interface ImportResult {
  orderId: string;
  localOrderId?: number;
  status: 'success' | 'error' | 'skipped';
  error?: string;
  reason?: string;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const importResults: ImportResult[] = [];
  
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body: OrderImportRequest = await req.json();
    const { orderId, importAll = false, limit = 20, status } = body;

    if (!orderId && !importAll) {
      return NextResponse.json({ 
        error: 'Debe proporcionar orderId o importAll=true' 
      }, { status: 400 });
    }

    // Verificar conexión con Mercado Libre
    const connected = await isConnected(parseInt(session.user.id));
    if (!connected) {
      return NextResponse.json({ 
        error: 'Usuario no conectado a Mercado Libre' 
      }, { status: 400 });
    }

    // Obtener información del usuario de ML
    const userInfo = await makeAuthenticatedRequest(
      parseInt(session.user.id),
      '/users/me'
    );

    if (!userInfo.ok) {
      return NextResponse.json({ 
        error: 'Error obteniendo información del usuario de ML' 
      }, { status: 400 });
    }

    const mlUser = await userInfo.json();
    const sellerId = mlUser.id.toString();

    logger.info('Iniciando importación de órdenes', {
      userId: session.user.id,
      sellerId,
      importAll,
      orderId,
    });

    // Determinar qué órdenes importar
    let ordersToImport: MercadoLibreOrder[] = [];

    if (importAll) {
      // Obtener órdenes recientes de Mercado Libre
      let url = `/orders/search?seller=${sellerId}&limit=${limit}`;
      if (status) {
        url += `&order.status=${status}`;
      }

      const response = await makeAuthenticatedRequest(
        parseInt(session.user.id),
        url
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new MercadoLibreError(
          MercadoLibreErrorCode.INVALID_REQUEST,
          `Error obteniendo órdenes de ML: ${errorData}`,
          { status: response.status, error: errorData }
        );
      }

      const ordersData = await response.json();
      ordersToImport = ordersData.results || [];
    } else if (orderId) {
      // Obtener orden específica
      const response = await makeAuthenticatedRequest(
        parseInt(session.user.id),
        `/orders/${orderId}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return NextResponse.json({ 
            error: 'Orden no encontrada en Mercado Libre' 
          }, { status: 404 });
        }
        const errorData = await response.text();
        throw new MercadoLibreError(
          MercadoLibreErrorCode.INVALID_REQUEST,
          `Error obteniendo orden de ML: ${errorData}`,
          { status: response.status, error: errorData }
        );
      }

      ordersToImport = [await response.json()];
    }

    if (ordersToImport.length === 0) {
      return NextResponse.json({ 
        message: 'No se encontraron órdenes para importar',
        results: []
      });
    }

    // Procesar cada orden
    for (const mlOrder of ordersToImport) {
      const result: ImportResult = {
        orderId: mlOrder.id,
        status: 'error',
      };

      try {
        // Verificar si la orden ya fue importada
        const existingImport = await db.query.mercadolibreOrdersImport.findFirst({
          where: eq(mercadolibreOrdersImport.mlOrderId, mlOrder.id),
        });

        if (existingImport) {
          result.status = 'skipped';
          result.reason = 'Orden ya importada previamente';
          importResults.push(result);
          continue;
        }

        // Verificar si ya existe una orden con ese ID de ML
        const existingOrder = await db.query.orders.findFirst({
          where: eq(orders.mlOrderId, mlOrder.id),
        });

        if (existingOrder) {
          result.status = 'skipped';
          result.reason = 'Orden ya existe en el sistema';
          importResults.push(result);
          continue;
        }

        // Mapear datos de la orden ML a formato local
        const orderData = {
          userId: parseInt(session.user.id), // Asociar al usuario actual
          total: mlOrder.total_amount?.toString() || '0',
          status: mapMLStatusToLocal(mlOrder.status) as 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'rejected',
          mlOrderId: mlOrder.id,
          source: 'mercadolibre',
          mlStatus: mlOrder.status,
          mlBuyerInfo: mlOrder.buyer,
          mlShippingInfo: mlOrder.shipping,
          mlPaymentInfo: mlOrder.payments,
          shippingAddress: mapShippingAddress(mlOrder.shipping),
          shippingCost: mlOrder.shipping?.shipping_option?.cost?.toString() || '0',
          createdAt: new Date(mlOrder.date_created),
          updatedAt: new Date(),
        };

        // Crear orden local primero
        const newOrder = await db.insert(orders).values(orderData).returning();
        const localOrderId = newOrder[0].id;

        // Crear registro de importación con el orderId
        const importRecord = await db.insert(mercadolibreOrdersImport).values({
          orderId: localOrderId,
          importStatus: 'pending',
          mlOrderId: mlOrder.id,
          mlOrderData: mlOrder,
        }).returning();

        // Procesar items de la orden
        if (mlOrder.order_items && mlOrder.order_items.length > 0) {
          const orderItemsData = [];

          for (const mlItem of mlOrder.order_items) {
            // Buscar producto local por ML item ID
            const localProduct = await db.query.products.findFirst({
              where: eq(products.mlItemId, mlItem.item.id),
            });

            if (localProduct) {
              orderItemsData.push({
                orderId: localOrderId,
                productId: localProduct.id,
                quantity: mlItem.quantity,
                price: mlItem.unit_price.toString(),
              });
            } else {
              // Si no existe el producto, crear un registro genérico
              logger.warn('Producto no encontrado para item de orden ML', {
                mlItemId: mlItem.item.id,
                orderId: mlOrder.id,
              });
            }
          }

          if (orderItemsData.length > 0) {
            await db.insert(orderItems).values(orderItemsData);
          }
        }

        // Actualizar registro de importación
        await db.update(mercadolibreOrdersImport)
          .set({
            orderId: localOrderId,
            importStatus: 'imported',
            importedAt: new Date(),
          })
          .where(eq(mercadolibreOrdersImport.id, importRecord[0].id));

        result.status = 'success';
        result.localOrderId = localOrderId;

        logger.info('Orden importada exitosamente', {
          mlOrderId: mlOrder.id,
          localOrderId,
          userId: session.user.id,
        });

      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        
        // Actualizar estado a error
        try {
          await db.update(mercadolibreOrdersImport)
            .set({
              importStatus: 'error',
              importError: result.error,
            })
            .where(eq(mercadolibreOrdersImport.mlOrderId, mlOrder.id));
        } catch (updateError) {
          logger.error('Error actualizando estado de importación', { 
            mlOrderId: mlOrder.id,
            updateError 
          });
        }

        logger.error('Error importando orden', {
          mlOrderId: mlOrder.id,
          error: result.error,
        });
      }

      importResults.push(result);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const successCount = importResults.filter(r => r.status === 'success').length;
    const errorCount = importResults.filter(r => r.status === 'error').length;
    const skippedCount = importResults.filter(r => r.status === 'skipped').length;

    logger.info('Importación de órdenes completada', {
      userId: session.user.id,
      totalOrders: ordersToImport.length,
      successCount,
      errorCount,
      skippedCount,
      duration: `${duration}ms`,
    });

    return NextResponse.json({
      success: true,
      summary: {
        total: ordersToImport.length,
        successful: successCount,
        failed: errorCount,
        skipped: skippedCount,
        duration: `${duration}ms`,
      },
      results: importResults,
    });

  } catch (error) {
    logger.error('Error en importación de órdenes', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Obtener registros de importación con filtros
    const whereCondition = status ? eq(mercadolibreOrdersImport.importStatus, status as 'pending' | 'error' | 'imported') : undefined;

    const importRecords = await db.query.mercadolibreOrdersImport.findMany({
      where: whereCondition,
      with: {
        order: true,
      },
      limit,
      offset,
      orderBy: (mercadolibreOrdersImport, { desc }) => [
        desc(mercadolibreOrdersImport.createdAt),
      ],
    });

    // Obtener estadísticas
    const stats = await db
      .select({
        status: mercadolibreOrdersImport.importStatus,
        count: count(mercadolibreOrdersImport.id),
      })
      .from(mercadolibreOrdersImport)
      .groupBy(mercadolibreOrdersImport.importStatus);

    return NextResponse.json({
      records: importRecords,
      stats,
      pagination: {
        limit,
        offset,
        total: importRecords.length,
      },
    });

  } catch (error) {
    logger.error('Error obteniendo registros de importación', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Funciones auxiliares
function mapMLStatusToLocal(mlStatus: string): string {
  const statusMap: Record<string, string> = {
    'paid': 'paid',
    'payment_required': 'pending',
    'payment_in_process': 'pending',
    'payment_pending': 'pending',
    'cancelled': 'cancelled',
    'confirmed': 'shipped',
    'pack_order': 'shipped',
    'handling': 'shipped',
    'shipped': 'shipped',
    'delivered': 'delivered',
    'not_delivered': 'cancelled',
  };

  return statusMap[mlStatus] || 'pending';
}

function mapShippingAddress(shipping: MercadoLibreOrder['shipping']): Record<string, string | null> | null {
  if (!shipping?.receiver_address) {
    return null;
  }

  const address = shipping.receiver_address;
  
  return {
    nombre: `${address.receiver_name || ''} ${address.receiver_lastname || ''}`.trim(),
    direccion: address.address_line || '',
    ciudad: address.city?.name || '',
    provincia: address.state?.name || '',
    codigoPostal: address.postal_code || '',
    telefono: address.receiver_phone || '',
  };
}
