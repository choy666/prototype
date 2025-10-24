#!/usr/bin/env tsx

import { db } from '../lib/db';
import { orders, orderItems } from '../lib/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/utils/logger';

/* eslint-disable @typescript-eslint/no-explicit-any */
async function createOrderFromPayment(payment: any) {
  try {
    logger.info('Creando orden desde pago aprobado', { paymentId: payment.id });

    // Extraer metadata del pago
    const metadata = payment.metadata || {};
    const userId = parseInt(metadata.userId);
    const shippingAddress = metadata.shippingAddress ? JSON.parse(metadata.shippingAddress) : null;
    const shippingMethodId = parseInt(metadata.shippingMethodId);
    const items = metadata.items ? JSON.parse(metadata.items) : [];
    const shippingCost = parseFloat(metadata.shippingCost || '0');
    const total = parseFloat(metadata.total || '0');

    if (!userId || !items.length) {
      logger.error('Metadata incompleta para crear orden', { userId, itemsCount: items.length });
      return;
    }

    // Crear la orden
    const newOrder = await db.insert(orders).values({
      userId,
      total: total.toString(),
      status: 'paid',
      paymentId: payment.id.toString(),
      mercadoPagoId: payment.id.toString(),
      shippingAddress,
      shippingMethodId,
      shippingCost: shippingCost.toString(),
    }).returning({ id: orders.id });

    const orderId = newOrder[0].id;
    logger.info('Orden creada exitosamente', { orderId, userId });

    // Crear los items de la orden
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderItemsData = items.map((item: any) => ({
      orderId,
      productId: parseInt(item.id),
      quantity: item.quantity,
      price: (item.discount && item.discount > 0
        ? parseFloat(item.price) * (1 - item.discount / 100)
        : parseFloat(item.price)).toString(),
    }));

    await db.insert(orderItems).values(orderItemsData);
    logger.info('Items de orden creados', { orderId, itemsCount: orderItemsData.length });

    return { orderId, userId };

  } catch (error) {
    logger.error('Error creando orden desde pago', {
      paymentId: payment.id,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

async function testOrderCreation() {
  console.log('🧪 Probando creación de orden...\n');

  // Datos de prueba simulados
  const mockPayment = {
    id: '123456789',
    status: 'approved',
    metadata: {
      userId: '4', // Usando el primer usuario existente (ID: 4)
      shippingAddress: JSON.stringify({
        nombre: 'Test User',
        direccion: 'Calle Falsa 123',
        ciudad: 'Buenos Aires',
        provincia: 'Buenos Aires',
        codigoPostal: '1000',
        telefono: '1123456789'
      }),
      shippingMethodId: '1',
      items: JSON.stringify([{
        id: '1', // Asumiendo que existe un producto con ID 1
        name: 'Producto de Prueba',
        price: '1000.00',
        quantity: 2
      }]),
      shippingCost: '500.00',
      subtotal: '2000.00',
      total: '2500.00'
    }
  };

  try {
    console.log('1. Creando orden con datos simulados...');
    const result = await createOrderFromPayment(mockPayment);
    if (!result) {
      console.log('❌ No se pudo crear la orden');
      return;
    }
    console.log('✅ Orden creada exitosamente:', result);

    console.log('\n2. Verificando orden en base de datos...');
    const createdOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, result.orderId));

    if (createdOrder.length > 0) {
      console.log('✅ Orden encontrada en BD:', createdOrder[0]);
    } else {
      console.log('❌ Orden no encontrada en BD');
    }

    console.log('\n3. Verificando items de orden...');
    const createdItems = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, result.orderId));

    console.log(`✅ ${createdItems.length} items encontrados:`, createdItems);

    console.log('\n🎉 Prueba completada exitosamente');

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    process.exit(1);
  }
}

// Ejecutar prueba
testOrderCreation().catch(console.error);
