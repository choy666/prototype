import { NextRequest, NextResponse } from 'next/server';
import { calculateMLShippingCost } from '@/lib/actions/shipments';

// Token de admin simple para pruebas (en producción usar sistema más robusto)
const ADMIN_TEST_TOKEN = process.env.MIGRATION_ADMIN_TOKEN || 'migration-admin-2024-secure-token';

// Verificación de seguridad básica
function verifyAdminToken(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const tokenFromQuery = new URL(request.url).searchParams.get('token');
  
  const token = authHeader?.replace('Bearer ', '') || tokenFromQuery;
  return token === ADMIN_TEST_TOKEN;
}

interface TestShippingRequest {
  zipcode: string;
  items: Array<{
    id: string;
    quantity: number;
    price: number;
  }>;
  logisticType?: 'drop_off' | 'me2' | 'me1';
  sellerAddressId?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verificar token de admin
    if (!verifyAdminToken(request)) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado - se requiere token de admin',
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    const body: TestShippingRequest = await request.json();
    
    // Validar request básico
    if (!body.zipcode || !body.items || !Array.isArray(body.items)) {
      return NextResponse.json({
        success: false,
        error: 'Datos inválidos: se requiere zipcode y items array',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    if (body.items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere al menos un item',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Validar cada item
    for (const item of body.items) {
      if (!item.id || !item.quantity || !item.price) {
        return NextResponse.json({
          success: false,
          error: 'Cada item debe tener id, quantity y price',
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }
    }

    const logisticType = body.logisticType || 'me2';
    
    console.log('🧪 Probando cálculo de envío ME2', { 
      zipcode: body.zipcode, 
      itemCount: body.items.length,
      logisticType
    });
    
    const shippingData = await calculateMLShippingCost(
      body.zipcode, 
      body.items, 
      body.sellerAddressId,
      logisticType
    );
    
    // Formatear respuesta simplificada para pruebas
    const simplifiedMethods = shippingData.methods.map(method => ({
      id: method.shipping_method_id,
      name: method.name,
      description: method.description,
      cost: method.cost,
      currencyId: method.currency_id,
      estimatedDeliveryDays: method.estimated_delivery_time?.value || 5,
      shippingMode: method.shipping_mode,
      logisticType: method.logistic_type,
    }));
    
    const result = {
      success: true,
      testInfo: {
        zipcode: body.zipcode,
        logisticType: logisticType,
        itemCount: body.items.length,
        totalItemsValue: body.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      },
      coverage: shippingData.coverage,
      destination: shippingData.destination,
      methods: simplifiedMethods,
      cheapestMethod: simplifiedMethods.length > 0 
        ? simplifiedMethods.reduce((min, method) => 
            method.cost < min.cost ? method : min
          )
        : null,
      input: {
        zipcodeTarget: shippingData.input.zipcode_target,
        dimensions: shippingData.input.dimensions,
        freeShipping: shippingData.input.free_shipping,
      },
      timestamp: new Date().toISOString()
    };

    console.log('✅ Prueba de envío completada', {
      zipcode: body.zipcode,
      logisticType,
      methodsCount: simplifiedMethods.length,
      cheapestCost: result.cheapestMethod?.cost || 0
    });

    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ Error en prueba de envío:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET endpoint para prueba rápida con parámetros
export async function GET(request: NextRequest) {
  try {
    // Verificar token de admin
    if (!verifyAdminToken(request)) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado - se requiere token de admin',
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const zipcode = searchParams.get('zipcode');
    const itemId = searchParams.get('item_id');
    const quantity = searchParams.get('quantity');
    const price = searchParams.get('price');
    const logisticType = searchParams.get('logisticType') as 'drop_off' | 'me2' | 'me1' || 'me2';
    
    if (!zipcode || !itemId || !quantity || !price) {
      return NextResponse.json({
        success: false,
        error: 'Parámetros requeridos: zipcode, item_id, quantity, price',
        example: '/api/admin/test-shipping?zipcode=1001&item_id=1&quantity=1&price=15000',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    const items = [{
      id: itemId,
      quantity: parseInt(quantity),
      price: parseFloat(price)
    }];
    
    console.log('🧪 Prueba rápida de envío (GET)', { 
      zipcode, 
      itemId,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      logisticType
    });
    
    const shippingData = await calculateMLShippingCost(zipcode, items, undefined, logisticType);
    
    const simplifiedMethods = shippingData.methods.map(method => ({
      id: method.shipping_method_id,
      name: method.name,
      cost: method.cost,
      currencyId: method.currency_id,
      estimatedDeliveryDays: method.estimated_delivery_time?.value || 5,
      logisticType: method.logistic_type,
    }));
    
    return NextResponse.json({
      success: true,
      testInfo: {
        zipcode,
        itemId,
        quantity: parseInt(quantity),
        price: parseFloat(price),
        logisticType
      },
      methods: simplifiedMethods,
      cheapestMethod: simplifiedMethods.length > 0 
        ? simplifiedMethods.reduce((min, method) => 
            method.cost < min.cost ? method : min
          )
        : null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error en prueba rápida de envío:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
