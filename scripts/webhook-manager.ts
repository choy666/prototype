#!/usr/bin/env tsx

import { MercadoPagoConfig } from 'mercadopago';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function validateWebhookConfig() {
  console.log('🔧 Validando configuración del webhook de Mercado Pago...\n');

  try {
    // Verificar variables de entorno
    console.log('1. Verificando variables de entorno...');

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const notificationUrl = process.env.MERCADO_PAGO_NOTIFICATION_URL;

    console.log(`   - Access Token: ${accessToken ? '✅ definido' : '❌ no definido'}`);
    console.log(`   - Notification URL: ${notificationUrl ? '✅ definido' : '❌ no definido'}`);

    if (!accessToken || !notificationUrl) {
      console.log('\n❌ Variables de entorno faltantes. Configura:');
      console.log('   - MERCADO_PAGO_ACCESS_TOKEN');
      console.log('   - MERCADO_PAGO_NOTIFICATION_URL');
      return;
    }

    // Verificar formato de la URL
    console.log('\n2. Validando formato de URLs...');

    try {
      new URL(notificationUrl);
      console.log('   - Notification URL: ✅ formato válido');
    } catch (e) {
      console.log('   - Notification URL: ❌ formato inválido');
    }

    // Verificar que sea HTTPS en producción
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && !notificationUrl.startsWith('https://')) {
      console.log('   ⚠️  Advertencia: La URL debe ser HTTPS en producción');
    } else if (!isProduction) {
      console.log('   - Ambiente desarrollo: ✅ HTTP permitido');
    }

    // Intentar inicializar cliente de Mercado Pago
    console.log('\n3. Probando conexión con Mercado Pago...');

    try {
      const client = new MercadoPagoConfig({ accessToken });
      console.log('   - Cliente Mercado Pago: ✅ inicializado correctamente');
    } catch (error) {
      console.log('   - Cliente Mercado Pago: ❌ error de inicialización');
      console.log('     Error:', error instanceof Error ? error.message : String(error));
    }

    // Verificar estructura del webhook endpoint
    console.log('\n4. Verificando estructura del endpoint del webhook...');

    const expectedEndpoint = '/api/webhooks/mercado-pago';
    console.log(`   - Endpoint esperado: ${expectedEndpoint}`);

    // Aquí se podría hacer una verificación adicional si tuviéramos acceso a la app corriendo

    console.log('\n5. Checklist de configuración:');
    console.log('   □ Acceder al dashboard de Mercado Pago');
    console.log('   □ Ir a Configuraciones > Notificaciones');
    console.log('   □ Crear nueva notificación:');
    console.log('     - URL: https://tu-dominio.com/api/webhooks/mercado-pago');
    console.log('     - Eventos: payment.updated');
    console.log('   □ Guardar y verificar que se reciba el ping de prueba');
    console.log('   □ Verificar logs del servidor para confirmar recepción');

    console.log('\n6. URLs importantes:');
    console.log('   - Dashboard Mercado Pago: https://www.mercadopago.com.ar/developers/panel/app');
    console.log('   - Documentación webhooks: https://www.mercadopago.com.ar/developers/es/guides/notifications/webhooks');

    console.log('\n✅ Validación de configuración completada.');

  } catch (error) {
    console.error('❌ Error durante la validación:', error);
  }
}

async function simulateWebhook() {
  console.log('🔄 Simulando envío de webhook de Mercado Pago...\n');

  const testMetadata = {
    userId: '4',
    total: '2500.00'
  };

  const webhookPayload = {
    action: 'payment.updated',
    data: {
      id: '987654321',
      status: 'rejected',
      metadata: testMetadata
    }
  };

  console.log('1. Payload del webhook a enviar:');
  console.log(JSON.stringify(webhookPayload, null, 2));

  const webhookUrl = 'http://localhost:3001/api/webhooks/mercadopago';

  console.log(`\n2. Enviando a: ${webhookUrl}`);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': 'test-webhook-' + Date.now()
      },
      body: JSON.stringify(webhookPayload)
    });

    console.log(`\n3. Respuesta del servidor:`);
    console.log(`   - Status: ${response.status}`);
    console.log(`   - Status Text: ${response.statusText}`);

    const responseBody = await response.text();
    console.log(`   - Body: ${responseBody}`);

    if (response.ok) {
      console.log('\n✅ Webhook simulado exitosamente');
    } else {
      console.log('\n❌ Error en el webhook simulado');
    }

  } catch (error) {
    console.log('\n❌ Error al enviar webhook:', error instanceof Error ? error.message : String(error));
    console.log('\n💡 Posibles causas:');
    console.log('   - El servidor no está corriendo');
    console.log('   - La URL del webhook es incorrecta');
    console.log('   - Problemas de red o firewall');
  }
}

function testWebhookStructure() {
  console.log('🧪 Probando estructura de datos del webhook de Mercado Pago...\n');

  const testItems = [{
    id: 1,
    name: 'Producto de Prueba',
    price: '1000.00',
    quantity: 2
  }];

  const testMetadata = {
    userId: '123',
    shippingAddress: JSON.stringify({
      nombre: 'Test User',
      direccion: 'Calle Falsa 123',
      ciudad: 'Buenos Aires',
      provincia: 'Buenos Aires',
      codigoPostal: '1000',
      telefono: '1123456789'
    }),
    shippingMethodId: '1',
    items: JSON.stringify(testItems),
    shippingCost: '500.00',
    subtotal: '2000.00',
    total: '2500.00'
  };

  console.log('1. Metadata preparada:', JSON.stringify(testMetadata, null, 2));

  const webhookPayload = {
    action: 'payment.updated',
    data: {
      id: '123456789',
      status: 'approved',
      metadata: testMetadata
    }
  };

  console.log('\n2. Payload del webhook simulado:');
  console.log(JSON.stringify(webhookPayload, null, 2));

  console.log('\n3. Validando estructura de datos...');

  const validations = [
    { field: 'userId', value: testMetadata.userId, expected: 'string', actual: typeof testMetadata.userId },
    { field: 'shippingMethodId', value: testMetadata.shippingMethodId, expected: 'string', actual: typeof testMetadata.shippingMethodId },
    { field: 'items', value: testMetadata.items, expected: 'string', actual: typeof testMetadata.items },
    { field: 'shippingCost', value: testMetadata.shippingCost, expected: 'string', actual: typeof testMetadata.shippingCost }
  ];

  validations.forEach(v => {
    const status = v.actual === v.expected ? '✅' : '❌';
    console.log(`   - ${v.field}: ${status} (esperado: ${v.expected}, actual: ${v.actual})`);
  });

  try {
    const parsedItems = JSON.parse(testMetadata.items);
    console.log('   - Items JSON: ✅ válido');
    console.log('     Contenido:', parsedItems);
  } catch (e) {
    console.log('   - Items JSON: ❌ inválido');
  }

  try {
    const parsedAddress = JSON.parse(testMetadata.shippingAddress);
    console.log('   - Shipping Address JSON: ✅ válido');
    console.log('     Contenido:', parsedAddress);
  } catch (e) {
    console.log('   - Shipping Address JSON: ❌ inválido');
  }

  const parsedItems = JSON.parse(testMetadata.items);
  const calculatedSubtotal = parsedItems.reduce((sum: number, item: any) =>
    sum + (parseFloat(item.price) * item.quantity), 0
  );
  const expectedSubtotal = parseFloat(testMetadata.subtotal);
  const subtotalMatch = Math.abs(calculatedSubtotal - expectedSubtotal) < 0.01;

  const calculatedTotal = calculatedSubtotal + parseFloat(testMetadata.shippingCost);
  const expectedTotal = parseFloat(testMetadata.total);
  const totalMatch = Math.abs(calculatedTotal - expectedTotal) < 0.01;

  console.log(`   - Subtotal: ${subtotalMatch ? '✅' : '❌'} (calculado: ${calculatedSubtotal}, esperado: ${expectedSubtotal})`);
  console.log(`   - Total: ${totalMatch ? '✅' : '❌'} (calculado: ${calculatedTotal}, esperado: ${expectedTotal})`);

  console.log('\n5. Casos de error simulados...');

  const errorCases = [
    { name: 'userId faltante', metadata: { ...testMetadata, userId: undefined } },
    { name: 'items vacío', metadata: { ...testMetadata, items: '[]' } },
    { name: 'JSON inválido', metadata: { ...testMetadata, items: 'invalid json' } },
    { name: 'precio negativo', metadata: { ...testMetadata, items: JSON.stringify([{ ...testItems[0], price: '-100' }]) } }
  ];

  errorCases.forEach(testCase => {
    try {
      if (!testCase.metadata.userId || !testCase.metadata.items) {
        throw new Error('Metadata incompleta');
      }

      const items = JSON.parse(testCase.metadata.items);
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Items inválidos');
      }

      items.forEach((item: any) => {
        if (parseFloat(item.price) < 0) {
          throw new Error('Precio inválido');
        }
      });

      console.log(`   - ${testCase.name}: ✅ pasó validaciones`);
    } catch (error) {
      console.log(`   - ${testCase.name}: ❌ error esperado - ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  console.log('\n✅ Pruebas de estructura completadas.');
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'validate':
      await validateWebhookConfig();
      break;
    case 'simulate':
      await simulateWebhook();
      break;
    case 'structure':
      testWebhookStructure();
      break;
    case 'all':
      await validateWebhookConfig();
      testWebhookStructure();
      await simulateWebhook();
      break;
    default:
      console.log('Uso: tsx webhook-manager.ts [validate|simulate|structure|all]');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { validateWebhookConfig, simulateWebhook, testWebhookStructure };
