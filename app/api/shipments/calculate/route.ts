import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth/session';
import { calculateME2Shipping } from '@/lib/mercado-envios/me2Api';
import { getProductsByIds } from '@/lib/mercado-envios/me2Validator';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';
// Imports no utilizados eliminados para limpiar warnings
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
  allowFallback: z.boolean().default(true),
  requestId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const requestId = crypto.randomUUID();
    logger.info('[ME2] API: Iniciando cálculo de envío', {
      method: 'POST',
      url: request.url,
      requestId,
      userAgent: request.headers.get('user-agent')
    });

    const session = await authOptions();
    
    if (!session?.user?.email) {
      logger.warn('[ME2] API: Acceso no autorizado', {
        requestId,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      });
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { zipcode, items, logisticType, allowFallback, requestId: clientRequestId } = calculateShippingSchema.parse(body);

    const effectiveRequestId = clientRequestId || requestId;

    logger.info('[ME2] Request: Datos recibidos', {
      requestId: effectiveRequestId,
      zipcode,
      itemsCount: items.length,
      logisticType,
      allowFallback,
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

    // Obtener productos enriquecidos desde la base de datos
    const productIds = items.map(item => parseInt(item.id, 10)).filter(id => !isNaN(id));
    const dbProducts = await getProductsByIds(productIds);

    // Mapear items con datos completos
    const enrichedItems = items.map(item => {
      const productId = parseInt(item.id, 10);
      const dbProduct = dbProducts.find(p => p.id === productId);
      
      return {
        id: productId,
        name: dbProduct?.name || 'Producto desconocido',
        quantity: item.quantity,
        price: item.price,
        mlItemId: item.mlItemId || dbProduct?.mlItemId || undefined,
        weight: item.weight || dbProduct?.weight,
        height: item.dimensions?.height || dbProduct?.height,
        width: item.dimensions?.width || dbProduct?.width,
        length: item.dimensions?.length || dbProduct?.length,
        shippingMode: dbProduct?.shippingMode,
        me2Compatible: dbProduct?.me2Compatible,
      };
    });

    // Llamar al nuevo servicio centralizado ME2
    const shippingData = await calculateME2Shipping({
      zipcode,
      items: enrichedItems,
      allowFallback,
    });

    // Formatear respuesta manteniendo compatibilidad
    const options = shippingData.shippingOptions.map(option => ({
      name: option.name,
      cost: option.cost || 0,
      estimated: option.estimated_delivery?.date 
        ? `${option.estimated_delivery.date}` 
        : `${shippingData.estimatedDelivery} días`,
    }));

    // Agregar opciones específicas ME2 si aplica
    if (shippingData.source === 'me2' && !shippingData.fallback) {
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
        requestId: effectiveRequestId,
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
        options: me2Options,
        warnings: shippingData.warnings,
        metadata: {
          calculationSource: shippingData.fallback ? 'FALLBACK' : 'ME2',
          calculationHash: `${zipcode}-${items.map(i => `${i.id}:${i.quantity}`).sort().join('-')}`,
          timestamp: new Date().toISOString(),
        }
      };

      logger.info('[ME2] Response: Cálculo ME2 completado', {
        requestId: effectiveRequestId,
        zipcode,
        success: true,
        optionsCount: me2Options.length,
        source: response.source,
        fallback: response.fallback,
        hasFreeShipping: me2Options.some(opt => opt.cost === 0),
        totalCost: Math.min(...me2Options.map(opt => opt.cost)),
        warningsCount: response.warnings?.length || 0
      });

      return NextResponse.json(response);
    }

    // Respuesta fallback local
    const response = {
      success: true,
      requestId: effectiveRequestId,
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
      options,
      warnings: shippingData.warnings,
      metadata: {
        calculationSource: shippingData.fallback ? 'FALLBACK' : 'ME2',
        calculationHash: `${zipcode}-${items.map(i => `${i.id}:${i.quantity}`).sort().join('-')}`,
        timestamp: new Date().toISOString(),
      }
    };

    logger.info('[ME2] Response: Cálculo completado', {
      requestId: effectiveRequestId,
      zipcode,
      success: true,
      optionsCount: options.length,
      source: response.source,
      fallback: response.fallback,
      hasFreeShipping: options.some(opt => opt.cost === 0),
      totalCost: Math.min(...options.map(opt => opt.cost)),
      warningsCount: response.warnings?.length || 0
    });

    return NextResponse.json(response);
    
  } catch (error) {
    const requestId = crypto.randomUUID();
    logger.error('[ME2] Error: Error en endpoint /api/shipments/calculate', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof z.ZodError ? 'VALIDATION_ERROR' : 'UNKNOWN',
      statusCode: error instanceof z.ZodError ? 400 : 500,
      url: request.url
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Datos inválidos', 
          requestId,
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
          { error: 'Límite de solicitudes excedido, intente en unos minutos', requestId },
          { status: 429 }
        );
      }
      
      if (error.message.includes('zip_code') || error.message.includes('código postal')) {
        return NextResponse.json(
          { error: 'Código postal no cubierto por el servicio de envío', requestId },
          { status: 400 }
        );
      }
      
      if (error.message.includes('product') || error.message.includes('item')) {
        return NextResponse.json(
          { error: 'Algunos productos no están disponibles para envío', requestId },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Error al calcular costo de envío', requestId },
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
      id: parseInt(itemId),
      quantity: parseInt(quantity),
      price: 0, // Will be fetched from DB
      mlItemId: mlItemId ?? undefined,
    }];
    
    logger.info('Calculating ML shipping cost (GET)', { 
      zipcode, 
      itemId,
      quantity: parseInt(quantity),
      userEmail: session.user.email 
    });
    
    const shippingData = await calculateME2Shipping({
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
