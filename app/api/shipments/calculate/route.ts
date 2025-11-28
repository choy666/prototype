import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth/session';
import { calculateME2ShippingCost } from '@/lib/actions/me2-shipping';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';
import { db } from '@/lib/db';
import type { MLShippingMethod } from '@/lib/types/shipping';

const calculateShippingSchema = z.object({
  zipcode: z.string().min(4, 'Código postal requerido'),
  items: z.array(z.object({
    id: z.string().min(1, 'ID del item requerido'),
    quantity: z.number().min(1, 'Cantidad debe ser mayor a 0'),
    price: z.number().min(0, 'Precio debe ser mayor o igual a 0'),
    mlItemId: z.string().optional(),
  })).min(1, 'Se requiere al menos un item'),
  sellerAddressId: z.string().optional(),
  logisticType: z.enum(['drop_off', 'me2', 'me1']).default('drop_off'),
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
    const { zipcode, items, logisticType } = calculateShippingSchema.parse(body);

    // Enriquecer items con mlItemId desde la base de datos cuando esté disponible
    const productIds = items
      .map(item => parseInt(item.id, 10))
      .filter(id => !Number.isNaN(id));

    let enrichedItems = items;

    if (productIds.length > 0) {
      const dbProducts = await db.query.products.findMany({
        where: (products, { inArray }) => inArray(products.id, productIds),
        columns: {
          id: true,
          mlItemId: true,
        },
      });

      const mlItemById = new Map<string, string | null>(
        dbProducts.map(p => [p.id.toString(), p.mlItemId ?? null]),
      );

      enrichedItems = items.map(item => ({
        ...item,
        mlItemId: item.mlItemId ?? mlItemById.get(item.id) ?? undefined,
      }));
    }

    logger.info('Calculating ML shipping cost', { 
      zipcode, 
      itemsCount: enrichedItems.length,
      logisticType,
      userEmail: session.user.email 
    });
    
    const shippingData = await calculateME2ShippingCost({
      zipcode,
      items: enrichedItems,
    });
    
    // Formatear respuesta para el frontend
    const formattedMethods = shippingData.shippingOptions.map((method: MLShippingMethod) => ({
      id: method.shipping_method_id,
      name: method.name,
      description: method.description,
      cost: method.cost,
      currencyId: method.currency_id,
      estimatedDelivery: {
        date: method.estimated_delivery?.date,
        timeFrom: method.estimated_delivery?.time_from,
        timeTo: method.estimated_delivery?.time_to,
      },
      estimatedTime: {
        type: method.estimated_delivery_time?.type,
        unit: method.estimated_delivery_time?.unit,
        value: method.estimated_delivery_time?.value,
      },
      shippingMode: method.shipping_mode,
      logisticType: method.logistic_type,
      treatment: method.treatment,
      guaranteed: method.guaranteed,
      orderPriority: method.order_priority,
      tags: method.tags,
      speed: method.speed,
    }));
    
    return NextResponse.json({
      success: true,
      coverage: shippingData.coverage,
      destination: shippingData.destination,
      methods: formattedMethods,
      source: shippingData.source,
      input: shippingData.input && {
        zipcodeTarget: shippingData.input.zipcode_target,
        dimensions: shippingData.input.dimensions,
        itemPrice: shippingData.input.item_price,
        freeShipping: shippingData.input.free_shipping,
        listCost: shippingData.input.list_cost,
        cost: shippingData.input.cost,
        sellerId: shippingData.input.seller_id,
      },
      fallback: shippingData.fallback ?? false,
      message: shippingData.message,
    });
    
  } catch (error) {
    logger.error('Error calculating shipping cost', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al calcular costo de envío' },
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
    const zipcode = searchParams.get('zipcode');
    const itemId = searchParams.get('item_id');
    const quantity = searchParams.get('quantity');
    const mlItemId = searchParams.get('ml_item_id');
    
    if (!zipcode || !itemId || !quantity) {
      return NextResponse.json(
        { error: 'Parámetros requeridos: zipcode, item_id, quantity' },
        { status: 400 }
      );
    }
    
    const items = [{
      id: itemId,
      quantity: parseInt(quantity),
      price: 0, // El precio no es necesario para cálculo básico
      mlItemId: mlItemId ?? undefined,
    }];
    
    logger.info('Calculating ML shipping cost (GET)', { 
      zipcode, 
      itemId,
      quantity: parseInt(quantity),
      userEmail: session.user.email 
    });
    
    const shippingData = await calculateME2ShippingCost({
      zipcode,
      items,
    });
    
    return NextResponse.json({
      success: true,
      methods: shippingData.shippingOptions.map((method: MLShippingMethod) => ({
        id: method.shipping_method_id,
        name: method.name,
        description: method.description,
        cost: method.cost,
        currencyId: method.currency_id,
        estimatedDelivery: method.estimated_delivery,
        shippingMode: method.shipping_mode,
        logisticType: method.logistic_type,
      }))
    });
    
  } catch (error) {
    logger.error('Error calculating shipping cost (GET)', error);
    
    return NextResponse.json(
      { error: 'Error al calcular costo de envío' },
      { status: 500 }
    );
  }
}
