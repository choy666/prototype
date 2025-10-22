import { MercadoPagoConfig, Preference } from "mercadopago";

// Script para simular el envío de un webhook de Mercado Pago
async function simulateWebhook() {
  console.log('🔄 Simulando envío de webhook de Mercado Pago...\n');

  // Simular datos de un pago aprobado
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

  const webhookPayload = {
    action: 'payment.updated',
    data: {
      id: '123456789',
      status: 'approved',
      metadata: testMetadata
    }
  };

  console.log('1. Payload del webhook a enviar:');
  console.log(JSON.stringify(webhookPayload, null, 2));

  // URL del webhook local (ajusta según tu configuración)
  const webhookUrl = process.env.MERCADO_PAGO_NOTIFICATION_URL || 'http://localhost:3001/api/webhooks/mercado-pago';

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

// Ejecutar simulación
simulateWebhook().catch(console.error);
