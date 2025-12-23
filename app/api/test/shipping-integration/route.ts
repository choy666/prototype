import { NextResponse } from 'next/server';
import { unifiedShipping } from '@/lib/services/unified-shipping';

interface TestResult {
  name: string;
  status: 'success' | 'error';
  options?: number;
  hasLocal?: boolean;
  hasTiendanube?: boolean;
  hasME2?: boolean;
  data?: {
    name: string;
    type: 'tiendanube' | 'me2' | 'local';
    cost: number;
    carrier?: string;
    estimated?: string;
  }[];
  error?: string;
  tiendanubeEnabled?: unknown;
  tiendanubeStoreId?: unknown;
  businessZipCode?: unknown;
}

interface TestResponse {
  timestamp: string;
  tests: TestResult[];
  summary?: {
    total: number;
    success: number;
    failed: number;
    overall: 'success' | 'partial';
  };
}

export async function POST() {
  const testResults: TestResponse = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: Envío local (mismo CP)
  try {
    console.log('[Test] Iniciando prueba de envío local...');
    const localResult = await unifiedShipping.calculateShipping({
      customerZip: '4700', // Mismo CP que el negocio
      items: [{
        id: '51',
        quantity: 1,
        price: 22750,
        weight: 1000,
        dimensions: { length: 40, width: 30, height: 20 }
      }],
      subtotal: 22750
    });

    testResults.tests.push({
      name: 'Envío Local',
      status: 'success',
      options: localResult.length,
      hasLocal: localResult.some(o => o.type === 'local'),
      data: localResult.map(o => ({
        name: o.name,
        type: o.type,
        cost: o.cost
      }))
    });
  } catch (error) {
    testResults.tests.push({
      name: 'Envío Local',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 2: Envío a otro CP (debería incluir Tiendanube y ME2)
  try {
    console.log('[Test] Iniciando prueba de envío a otro CP...');
    const remoteResult = await unifiedShipping.calculateShipping({
      customerZip: '5500', // Salta
      items: [{
        id: '51',
        quantity: 1,
        price: 22750,
        weight: 1000,
        dimensions: { length: 40, width: 30, height: 20 }
      }],
      subtotal: 22750
    });

    testResults.tests.push({
      name: 'Envío Remoto',
      status: 'success',
      options: remoteResult.length,
      hasTiendanube: remoteResult.some(o => o.type === 'tiendanube'),
      hasME2: remoteResult.some(o => o.type === 'me2'),
      hasLocal: remoteResult.some(o => o.type === 'local'),
      data: remoteResult.map(o => ({
        name: o.name,
        type: o.type,
        carrier: o.carrier,
        cost: o.cost,
        estimated: o.estimated
      }))
    });
  } catch (error) {
    testResults.tests.push({
      name: 'Envío Remoto',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 3: Verificar configuración
  try {
    const settings = await unifiedShipping.getBusinessSettings();
    testResults.tests.push({
      name: 'Configuración',
      status: 'success',
      tiendanubeEnabled: settings.tiendanubeEnabled,
      tiendanubeStoreId: settings.tiendanubeStoreId,
      businessZipCode: settings.business_zip_code
    });
  } catch (error) {
    testResults.tests.push({
      name: 'Configuración',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Resumen
  const successCount = testResults.tests.filter(t => t.status === 'success').length;
  testResults.summary = {
    total: testResults.tests.length,
    success: successCount,
    failed: testResults.tests.length - successCount,
    overall: successCount === testResults.tests.length ? 'success' : 'partial'
  };

  return NextResponse.json(testResults);
}
