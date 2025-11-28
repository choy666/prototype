import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth/session';
import { calculateME2ShippingCost } from '@/lib/actions/me2-shipping';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';
import { db } from '@/lib/db';
import { products } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import type { MLShippingMethod } from '@/lib/types/shipping';

const calculateShippingSchema = z.object({
  zipcode: z.string().min(4, 'Código postal requerido'),
  items: z.array(z.object({
    id: z.string().min(1, 'ID del item requerido'),
    quantity: z.number().min(1, 'Cantidad debe ser mayor a 0'),
    price: z.number().min(0, 'Precio debe ser mayor o igual a 0'),
    mlItemId: z.string().optional(),
    weight: z.number().min(0.1, 'Peso requerido en gramos').optional(),
    dimensions: z.object({
      height: z.number().min(1, 'Altura requerida en cm'),
      width: z.number().min(1, 'Ancho requerido en cm'),
      length: z.number().min(1, 'Largo requerido en cm'),
    }).optional(),
  })).min(1, 'Se requiere al menos un item'),
  sellerAddressId: z.string().optional(),
  logisticType: z.enum(['drop_off', 'me2', 'me1']).default('me2'),
});

export async function POST(request: NextRequest) {
  try {
    logger.info('[ME2] API: Iniciando cálculo de envío', {
      method: 'POST',
      url: request.url,
      userAgent: request.headers.get('user-agent')
    });

    const session = await authOptions();
    
    if (!session?.user?.email) {
      logger.warn('[ME2] API: Acceso no autorizado', {
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      });
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { zipcode, items, logisticType } = calculateShippingSchema.parse(body);

    logger.info('[ME2] Request: Datos recibidos', {
      zipcode,
      itemsCount: items.length,
      logisticType,
      userEmail: session.user.email,
      items: items.map(i => ({ 
        id: i.id, 
        quantity: i.quantity, 
        price: i.price,
        hasMlItemId: !!i.mlItemId,
        hasWeight: !!i.weight,
        hasDimensions: !!i.dimensions
      }))
    });

    // Enriquecer items con datos de la base de datos
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const productId = parseInt(item.id, 10);
        if (isNaN(productId)) {
          return {
            ...item,
            shippingMode: undefined,
            me2Compatible: false,
          };
        }

        const dbProduct = await db.query.products.findFirst({
          where: eq(products.id, productId),
          columns: {
            id: true,
            mlItemId: true,
            weight: true,
            height: true,
            width: true,
            length: true,
            shippingMode: true,
            me2Compatible: true,
          }
        });

        // Usar valores de BD si no se proporcionan en el request
        return {
          ...item,
          mlItemId: item.mlItemId || dbProduct?.mlItemId || undefined,
          weight: item.weight || Number(dbProduct?.weight) || 0.5,
          dimensions: item.dimensions || {
            height: Number(dbProduct?.height) || 10,
            width: Number(dbProduct?.width) || 10,
            length: Number(dbProduct?.length) || 10,
          },
          shippingMode: dbProduct?.shippingMode,
          me2Compatible: dbProduct?.me2Compatible,
        };
      })
    );

    // Validar que los productos sean compatibles con ME2
    const incompatibleProducts = enrichedItems.filter(item => !item.me2Compatible);
    if (incompatibleProducts.length > 0) {
      logger.warn('[ME2] Validación: Productos no compatibles con ME2', {
        zipcode,
        incompatibleProducts: incompatibleProducts.map(p => p.id),
        fallbackActivated: true
      });
    }

    // Calcular dimensiones totales para el request
    const totalDimensions = {
      height: enrichedItems.reduce((sum, item) => sum + (item.dimensions?.height || 10) * item.quantity, 0),
      width: Math.max(...enrichedItems.map(item => item.dimensions?.width || 10)),
      length: Math.max(...enrichedItems.map(item => item.dimensions?.length || 10)),
      weight: enrichedItems.reduce((sum, item) => sum + (item.weight || 0.5) * item.quantity, 0),
    };

    logger.info('[ME2] Request: Dimensiones calculadas', {
      zipcode,
      dimensions: totalDimensions,
      totalWeight: totalDimensions.weight
    });

    // Llamar a la función principal de cálculo ME2
    const shippingData = await calculateME2ShippingCost({
      zipcode,
      items: enrichedItems.map(item => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        mlItemId: item.mlItemId,
      })),
      dimensions: totalDimensions,
    });

    // Formatear respuesta mejorada según especificación
    const options = shippingData.shippingOptions.map(option => ({
      name: option.name,
      cost: option.cost || 0,
      estimated: option.estimated_delivery?.date 
        ? `${option.estimated_delivery.date}` 
        : `${shippingData.estimatedDelivery} días`,
    }));

    // Agregar opciones específicas ME2 si aplica
    if (shippingData.source === 'me2' && !shippingData.fallback) {
      // Asegurar que tengamos las opciones estándar ME2
      const me2Options = [
        { name: 'ME2 Standard', cost: options[0]?.cost || 2390, estimated: '3-5 días' },
        { name: 'ME2 Prioritario', cost: options[1]?.cost || 3120, estimated: '1-2 días' },
      ];
      
      // Buscar opción de retiro en correo
      const agencyOption = shippingData.shippingOptions.find(opt => 
        opt.logistic_type === 'agency' || opt.description?.includes('correo')
      );
      
      if (agencyOption) {
        me2Options.push({
          name: 'Retiro en correo',
          cost: agencyOption.cost || 0,
          estimated: agencyOption.estimated_delivery?.date || '2-3 días'
        });
      }

      const response = {
        success: true,
        coverage: shippingData.coverage,
        destination: shippingData.destination,
        methods: shippingData.shippingOptions,
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
        message: shippingData.message || 'Cálculo ME2 exitoso',
        // Nuevos campos para compatibilidad con especificación
        options: me2Options,
      };

      logger.info('[ME2] Response: Cálculo ME2 completado', {
        zipcode,
        success: true,
        optionsCount: me2Options.length,
        source: response.source,
        hasFreeShipping: me2Options.some(opt => opt.cost === 0),
        totalCost: Math.min(...me2Options.map(opt => opt.cost))
      });

      return NextResponse.json(response);
    }

    // Respuesta fallback local
    const response = {
      success: true,
      coverage: shippingData.coverage,
      destination: shippingData.destination,
      methods: shippingData.shippingOptions,
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
      message: shippingData.message || (shippingData.fallback ? 'Usando métodos de envío locales' : 'Cálculo exitoso'),
      // Nuevos campos para compatibilidad
      options,
      warnings: shippingData.fallback ? ['Código postal sin cobertura ME2, usando envío local'] : undefined,
    };

    logger.info('[ME2] Response: Cálculo completado', {
      zipcode,
      success: true,
      optionsCount: options.length,
      source: response.source,
      hasFreeShipping: options.some(opt => opt.cost === 0),
      totalCost: Math.min(...options.map(opt => opt.cost))
    });

    return NextResponse.json(response);
    
  } catch (error) {
    logger.error('[ME2] Error: Error en endpoint /api/shipments/calculate', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof z.ZodError ? 'VALIDATION_ERROR' : 'UNKNOWN',
      statusCode: error instanceof z.ZodError ? 400 : 500,
      url: request.url
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Datos inválidos', 
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    // Manejo específico de errores comunes
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Límite de solicitudes excedido, intente en unos minutos' },
          { status: 429 }
        );
      }
      
      if (error.message.includes('zip_code') || error.message.includes('código postal')) {
        return NextResponse.json(
          { error: 'Código postal no cubierto por el servicio de envío' },
          { status: 400 }
        );
      }
      
      if (error.message.includes('product') || error.message.includes('item')) {
        return NextResponse.json(
          { error: 'Algunos productos no están disponibles para envío' },
          { status: 400 }
        );
      }
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
