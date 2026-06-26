'use server';

import { db } from '@/lib/db';
import { orders, orderItems, products, productVariants, stockLogs, mercadolibreOrdersImport } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { makeAuthenticatedRequest } from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';

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

function mapMLStatusToLocal(mlStatus: string): 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'rejected' {
  const statusMap: Record<string, 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'> = {
    paid: 'paid',
    payment_required: 'pending',
    payment_in_process: 'pending',
    payment_pending: 'pending',
    cancelled: 'cancelled',
    confirmed: 'shipped',
    pack_order: 'shipped',
    handling: 'shipped',
    shipped: 'shipped',
    delivered: 'delivered',
    not_delivered: 'cancelled',
  };

  return statusMap[mlStatus] || 'pending';
}

function mapShippingAddress(shipping: MercadoLibreOrder['shipping']): Record<string, string | null> | null {
  if (!shipping?.receiver_address) return null;
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

async function deductStockForMLOrder(localOrderId: number, userId: number, mlOrderId: string) {
  const current = await db
    .select({ stockDeducted: orders.stockDeducted })
    .from(orders)
    .where(eq(orders.id, localOrderId))
    .limit(1);

  if (current.length === 0) {
    throw new Error('Orden local no encontrada');
  }

  if (current[0].stockDeducted) {
    return { deducted: false };
  }

  const items = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, localOrderId),
  });

  if (!items || items.length === 0) {
    await db.update(orders).set({ stockDeducted: true }).where(eq(orders.id, localOrderId));
    return { deducted: false };
  }

  let adjusted = 0;

  for (const item of items) {
    try {
      const localProduct = await db.query.products.findFirst({
        where: eq(products.id, item.productId),
        with: {
          variants: {
            where: eq(productVariants.isActive, true),
          },
        },
      });

      if (!localProduct) continue;

      let deducted = false;

      if (localProduct.variants && Array.isArray(localProduct.variants)) {
        for (const variant of localProduct.variants) {
          if (variant.stock >= item.quantity) {
            await db
              .update(productVariants)
              .set({
                stock: sql`${productVariants.stock} - ${item.quantity}`,
                updated_at: new Date(),
              })
              .where(eq(productVariants.id, variant.id));

            await db.insert(stockLogs).values({
              productId: item.productId,
              variantId: variant.id,
              oldStock: variant.stock,
              newStock: Math.max(0, variant.stock - item.quantity),
              change: -item.quantity,
              reason: `Venta ML - Orden ${mlOrderId}`,
              userId,
              created_at: new Date(),
            });

            deducted = true;
            adjusted++;
            break;
          }
        }
      }

      if (!deducted) {
        await db
          .update(products)
          .set({
            stock: sql`${products.stock} - ${item.quantity}`,
            updated_at: new Date(),
          })
          .where(eq(products.id, item.productId));

        await db.insert(stockLogs).values({
          productId: item.productId,
          oldStock: localProduct.stock,
          newStock: Math.max(0, localProduct.stock - item.quantity),
          change: -item.quantity,
          reason: `Venta ML - Orden ${mlOrderId}`,
          userId,
          created_at: new Date(),
        });

        adjusted++;
      }
    } catch (error) {
      logger.error('Error deduciendo stock para orden ML', {
        localOrderId,
        mlOrderId,
        productId: item.productId,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
  }

  await db.update(orders).set({ stockDeducted: true }).where(eq(orders.id, localOrderId));

  return { deducted: true, adjusted };
}

export async function importMercadoLibreOrderById(params: {
  localUserId: number;
  mlOrderId: string;
}) {
  const { localUserId, mlOrderId } = params;

  const response = await makeAuthenticatedRequest(localUserId, `/orders/${mlOrderId}`);
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Error obteniendo orden ML ${mlOrderId}: ${response.status} ${errorText}`);
  }

  const mlOrder: MercadoLibreOrder = await response.json();

  const existingOrder = await db.query.orders.findFirst({
    where: eq(orders.mlOrderId, mlOrder.id),
  });

  let localOrderId: number;

  if (existingOrder) {
    localOrderId = existingOrder.id;

    await db
      .update(orders)
      .set({
        status: mapMLStatusToLocal(mlOrder.status),
        mlStatus: mlOrder.status,
        mlBuyerInfo: mlOrder.buyer || null,
        mlShippingInfo: mlOrder.shipping || null,
        mlPaymentInfo: mlOrder.payments || null,
        shippingAddress: mapShippingAddress(mlOrder.shipping),
        shippingCost: (mlOrder.shipping?.shipping_option?.cost ?? 0).toString(),
        total: (mlOrder.total_amount ?? 0).toString(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, localOrderId));
  } else {
    const inserted = await db
      .insert(orders)
      .values({
        userId: localUserId,
        total: (mlOrder.total_amount ?? 0).toString(),
        status: mapMLStatusToLocal(mlOrder.status),
        mlOrderId: mlOrder.id,
        source: 'mercadolibre',
        mlStatus: mlOrder.status,
        mlBuyerInfo: mlOrder.buyer || null,
        mlShippingInfo: mlOrder.shipping || null,
        mlPaymentInfo: mlOrder.payments || null,
        shippingAddress: mapShippingAddress(mlOrder.shipping),
        shippingCost: (mlOrder.shipping?.shipping_option?.cost ?? 0).toString(),
        createdAt: new Date(mlOrder.date_created),
        updatedAt: new Date(),
        stockDeducted: false,
      })
      .returning({ id: orders.id });

    localOrderId = inserted[0].id;

    const existingItems = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.orderId, localOrderId))
      .limit(1);

    if (existingItems.length === 0 && mlOrder.order_items && mlOrder.order_items.length > 0) {
      const itemsToInsert: Array<{ orderId: number; productId: number; quantity: number; price: string }> = [];

      for (const mlItem of mlOrder.order_items) {
        const localProduct = await db.query.products.findFirst({
          where: eq(products.mlItemId, mlItem.item.id),
        });

        if (!localProduct) {
          logger.warn('Producto no encontrado para item de orden ML (import automático)', {
            mlItemId: mlItem.item.id,
            mlOrderId: mlOrder.id,
          });
          continue;
        }

        itemsToInsert.push({
          orderId: localOrderId,
          productId: localProduct.id,
          quantity: mlItem.quantity,
          price: mlItem.unit_price.toString(),
        });
      }

      if (itemsToInsert.length > 0) {
        await db.insert(orderItems).values(itemsToInsert);
      }
    }
  }

  await db
    .insert(mercadolibreOrdersImport)
    .values({
      orderId: localOrderId,
      importStatus: 'imported',
      importedAt: new Date(),
      mlOrderId: mlOrder.id,
      mlOrderData: mlOrder,
    })
    .onConflictDoUpdate({
      target: mercadolibreOrdersImport.mlOrderId,
      set: {
        orderId: localOrderId,
        importStatus: 'imported',
        importedAt: new Date(),
        importError: null,
        mlOrderData: mlOrder,
      },
    });

  const deduction = await deductStockForMLOrder(localOrderId, localUserId, mlOrder.id);

  logger.info('Orden ML importada automáticamente', {
    mlOrderId: mlOrder.id,
    localOrderId,
    stockDeducted: deduction.deducted,
  });

  return {
    localOrderId,
    mlOrderId: mlOrder.id,
    stockDeducted: deduction.deducted,
  };
}
