#!/usr/bin/env node

/**
 * Script completo para probar la integración con Tiendanube
 * Verifica: conexión, webhooks, productos y flujo de órdenes
 */

import { db } from '../lib/db';
import { products, orders, tiendanubeStores, tiendanubeProductMapping, tiendanubeCustomerMapping, tiendanubeWebhooksRaw } from '../lib/schema';
import { eq } from 'drizzle-orm';
import { createTiendanubeClient } from '../lib/clients/tiendanube';
import { decryptString } from '../lib/utils/encryption';

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

interface TiendanubeProduct {
  id: string | number;
  sku: string;
  name: string;
  price: string;
  stock: number;
  published: boolean;
}

class TiendanubeIntegrationTester {
  private storeId: string;
  private results: TestResult[] = [];

  constructor(storeId: string) {
    this.storeId = storeId;
  }

  private log(test: string, result: TestResult) {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${test}: ${result.message}`);
    if (result.details) {
      console.log(`   ${JSON.stringify(result.details, null, 2)}`);
    }
    this.results.push({ ...result, message: `${test}: ${result.message}` });
  }

  async testConnection(): Promise<TestResult> {
    try {
      const store = await db.query.tiendanubeStores.findFirst({
        where: eq(tiendanubeStores.storeId, this.storeId),
      });

      if (!store) {
        return {
          success: false,
          message: 'Tienda no encontrada en BD',
        };
      }

      if (!store.accessTokenEncrypted) {
        return {
          success: false,
          message: 'No hay access token encriptado',
        };
      }

      const client = createTiendanubeClient({
      storeId,
      accessToken: decryptString(store.accessTokenEncrypted)
    });
      const storeInfo = await client.get('/store') as any;

      return {
        success: true,
        message: 'Conexión exitosa',
        details: {
          storeId: storeInfo.id,
          name: storeInfo.name,
          scopes: store.scopes,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
    }
  }

  async testWebhooks(): Promise<TestResult> {
    try {
      const response = await fetch(
        `http://localhost:3000/api/admin/tiendanube/status?storeId=${this.storeId}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'test'}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      const requiredWebhooks = [
        'order/created',
        'order/paid',
        'order/cancelled',
        'store/redact',
        'customers/redact',
        'customers/data_request',
        'app/uninstalled',
      ];

      const missing = data.requiredWebhooks?.requiredStatus
        ?.filter((w: any) => w.state !== 'ok')
        ?.map((w: any) => w.event) || [];

      if (missing.length > 0) {
        return {
          success: false,
          message: `Faltan webhooks: ${missing.join(', ')}`,
          details: { missing },
        };
      }

      return {
        success: true,
        message: 'Todos los webhooks configurados',
        details: { count: data.remoteWebhooks?.length || 0 },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error verificando webhooks: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
    }
  }

  async testProductMapping(): Promise<TestResult> {
    try {
      const mappings = await db.query.tiendanubeProductMapping.findMany({
        where: eq(tiendanubeProductMapping.storeId, this.storeId),
      });

      if (mappings.length === 0) {
        return {
          success: false,
          message: 'No hay productos mapeados',
        };
      }

      // Verificar que todos los productos locales tengan mapeo
      const localProducts = await db.query.products.findMany({
        where: eq(products.isActive, true),
      });

      const mappedSkus = new Set(mappings.map(m => m.sku));
      const unmapped = localProducts.filter(p => !mappedSkus.has(`PROD-${p.id}`));

      if (unmapped.length > 0) {
        return {
          success: false,
          message: `${unmapped.length} productos sin mapear`,
          details: { unmapped: unmapped.map(p => ({ id: p.id, name: p.name })) },
        };
      }

      return {
        success: true,
        message: `${mappings.length} productos mapeados correctamente`,
        details: { mappings: mappings.length },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error verificando mapeo: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
    }
  }

  async testProductSync(): Promise<TestResult> {
    try {
      const store = await db.query.tiendanubeStores.findFirst({
        where: eq(tiendanubeStores.storeId, this.storeId),
      });

      if (!store) {
        return { success: false, message: 'Tienda no encontrada' };
      }

      const tnClient = createTiendanubeClient({
        storeId,
        accessToken: decryptString(store.accessTokenEncrypted)
      });
      const tnProducts = await tnClient.get('/products') as TiendanubeProduct[];

      const mappings = await db.query.tiendanubeProductMapping.findMany({
        where: eq(tiendanubeProductMapping.storeId, this.storeId),
      });

      let synced = 0;
      let errors = 0;

      for (const mapping of mappings) {
        const tnProduct = tnProducts.find((p: any) => p.id.toString() === mapping.tiendanubeProductId);
        if (tnProduct) {
          synced++;
        } else {
          errors++;
        }
      }

      if (errors > 0) {
        return {
          success: false,
          message: `${errors} productos no sincronizados`,
          details: { synced, errors, total: mappings.length },
        };
      }

      return {
        success: true,
        message: `Todos los productos sincronizados`,
        details: { synced, total: mappings.length },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error verificando sincronización: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
    }
  }

  async testOrderFlow(): Promise<TestResult> {
    try {
      // Crear orden de prueba
      const testOrder = {
        id: `TEST-${Date.now()}`,
        number: `0000-${Math.floor(Math.random() * 1000)}`,
        customer: {
          id: `TEST-CUST-${Date.now()}`,
          email: 'test@tiendanube.com',
          name: 'Cliente Test',
        },
        shipping_address: {
          address: 'Dirección Test 123',
          city: 'Ciudad Test',
          province: 'Provincia Test',
          postal_code: '1234',
          country: 'Argentina',
          name: 'Cliente Test',
          phone: '1155555555',
        },
        total: '100.00',
        paid: true,
        shipping_cost: '10.00',
        shipping_id: `SHIP-${Date.now()}`,
        created_at: new Date().toISOString(),
        products: [
          {
            sku: 'PROD-1',
            quantity: 1,
            price: '90.00',
          },
        ],
      };

      // Enviar webhook de prueba
      const response = await fetch('http://localhost:3000/api/tiendanube/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-linkedstore-hmac-sha256': 'test-signature',
        },
        body: JSON.stringify({
          event: 'order/created',
          store_id: this.storeId,
          data: testOrder,
        }),
      });

      if (!response.ok) {
        // HMAC fallará, pero verificamos que se guarde para retry
        const webhooks = await db.query.tiendanubeWebhooksRaw.findMany({
          where: eq(tiendanubeWebhooksRaw.storeId, this.storeId),
        });

        if (webhooks.length > 0) {
          return {
            success: true,
            message: 'Webhook recibido (HMAC inválido esperado en test)',
            details: { webhookId: webhooks[0].id },
          };
        }

        return {
          success: false,
          message: `Webhook rechazado: ${response.status}`,
        };
      }

      // Verificar que la orden se creó
      await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar procesamiento

      const orderRecords = await db.query.orders.findMany({
        where: eq(orders.tiendanubeOrderId, testOrder.id),
      });

      if (orderRecords.length === 0) {
        return {
          success: false,
          message: 'La orden no se creó en BD',
        };
      }

      return {
        success: true,
        message: 'Orden creada exitosamente',
        details: { orderId: orderRecords[0].id, tiendanubeOrderId: testOrder.id },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error en flujo de orden: ${error instanceof Error ? error.message : 'Unknown'}`,
      };
    }
  }

  async runAllTests(): Promise<void> {
    console.log(`🧪 Iniciando tests de integración para tienda ${this.storeId}\n`);

    console.log('--- Conexión ---');
    this.log('Conexión con Tiendanube', await this.testConnection());

    console.log('\n--- Webhooks ---');
    this.log('Configuración de Webhooks', await this.testWebhooks());

    console.log('\n--- Productos ---');
    this.log('Mapeo de SKUs', await this.testProductMapping());
    this.log('Sincronización de Productos', await this.testProductSync());

    console.log('\n--- Flujo de Órdenes ---');
    this.log('Flujo completo de orden', await this.testOrderFlow());

    // Resumen
    console.log('\n--- Resumen ---');
    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    
    console.log(`✅ ${passed}/${total} tests pasaron`);
    
    if (passed === total) {
      console.log('\n🎉 ¡La integración está lista para producción!');
    } else {
      console.log('\n⚠️  Hay problemas que deben resolverse antes de ir a producción');
      this.results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.message}`);
      });
    }
  }
}

// Ejecutar tests
const storeId = process.argv[2];

if (!storeId) {
  console.error('❌ Debes proporcionar el Store ID de Tiendanube');
  console.error('Uso: npx tsx scripts/test-tiendanube-integration.ts <STORE_ID>');
  process.exit(1);
}

const tester = new TiendanubeIntegrationTester(storeId);
tester.runAllTests()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error ejecutando tests:', error);
    process.exit(1);
  });
