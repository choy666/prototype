import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth/session';
import { calculateMLShippingCost } from '@/lib/actions/shipments';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

const calculateShippingSchema = z.object({
  zipcode: z.string().min(4, 'Código postal requerido'),
  items: z.array(z.object({
    id: z.string().min(1, 'ID del item requerido'),
    quantity: z.number().min(1, 'Cantidad debe ser mayor a 0'),
    price: z.number().min(0, 'Precio debe ser mayor o igual a 0')
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
    const { zipcode, items, sellerAddressId, logisticType } = calculateShippingSchema.parse(body);
    
    logger.info('Calculating ML shipping cost', { 
      zipcode, 
      itemsCount: items.length,
      logisticType,
      userEmail: session.user.email 
    });
    
    const shippingData = await calculateMLShippingCost(zipcode, items, sellerAddressId, logisticType);
    
    // Formatear respuesta para el frontend
    const formattedMethods = shippingData.methods.map(method => ({
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
      input: {
        zipcodeTarget: shippingData.input.zipcode_target,
        dimensions: shippingData.input.dimensions,
        itemPrice: shippingData.input.item_price,
        freeShipping: shippingData.input.free_shipping,
        listCost: shippingData.input.list_cost,
        cost: shippingData.input.cost,
        sellerId: shippingData.input.seller_id,
      }
    });
    
  } catch (error) {
    logger.error('Error calculating shipping cost', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }
    
    // Si hay error con la API de ML, devolver métodos de envío locales como fallback
    if (error instanceof Error && (error.message?.includes('Mercado Libre') || error.message?.includes('token'))) {
      logger.warn('ML API unavailable, using fallback shipping methods');
      
      return NextResponse.json({
        success: true,
        fallback: true,
        message: 'Usando métodos de envío locales (API de ML no disponible)',
        methods: [
          {
            id: 'standard',
            name: 'Envío Estándar',
            description: 'Entrega en 3-5 días hábiles',
            cost: 500,
            currencyId: 'ARS',
            estimatedDelivery: {
              date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              timeFrom: '09:00',
              timeTo: '18:00',
            },
            estimatedTime: {
              type: 'known_frame',
              unit: 'days',
              value: 5,
            },
            shippingMode: 'standard',
            logisticType: 'drop_off',
            treatment: 'default',
            guaranteed: false,
            orderPriority: 1,
            tags: [],
            speed: {
              handling: 1,
              shipping: 4,
            },
          },
          {
            id: 'express',
            name: 'Envío Express',
            description: 'Entrega en 1-2 días hábiles',
            cost: 800,
            currencyId: 'ARS',
            estimatedDelivery: {
              date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              timeFrom: '09:00',
              timeTo: '18:00',
            },
            estimatedTime: {
              type: 'known_frame',
              unit: 'days',
              value: 2,
            },
            shippingMode: 'express',
            logisticType: 'drop_off',
            treatment: 'default',
            guaranteed: true,
            orderPriority: 2,
            tags: ['express'],
            speed: {
              handling: 0.5,
              shipping: 1.5,
            },
          }
        ]
      });
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
    
    if (!zipcode || !itemId || !quantity) {
      return NextResponse.json(
        { error: 'Parámetros requeridos: zipcode, item_id, quantity' },
        { status: 400 }
      );
    }
    
    const items = [{
      id: itemId,
      quantity: parseInt(quantity),
      price: 0 // El precio no es necesario para cálculo básico
    }];
    
    logger.info('Calculating ML shipping cost (GET)', { 
      zipcode, 
      itemId,
      quantity: parseInt(quantity),
      userEmail: session.user.email 
    });
    
    const shippingData = await calculateMLShippingCost(zipcode, items);
    
    return NextResponse.json({
      success: true,
      methods: shippingData.methods.map(method => ({
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
