// Script para probar la estructura de datos del webhook de Mercado Pago
// No requiere conexión a BD para validar formatos

function testWebhookDataStructure() {
  console.log('🧪 Probando estructura de datos del webhook de Mercado Pago...\n');

  // Datos de prueba simulados (sin BD)
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

  // Simular payload del webhook
  console.log('\n2. Payload del webhook simulado:');

  const webhookPayload = {
    action: 'payment.updated',
    data: {
      id: '123456789',
      status: 'approved',
      metadata: testMetadata
    }
  };

  console.log(JSON.stringify(webhookPayload, null, 2));

  console.log('\n3. Validando estructura de datos...');

  // Validar tipos de datos
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

  // Verificar parsing de JSON
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

  // Validar cálculos
  console.log('\n4. Validando cálculos...');

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

  // Simular errores comunes
  const errorCases = [
    { name: 'userId faltante', metadata: { ...testMetadata, userId: undefined } },
    { name: 'items vacío', metadata: { ...testMetadata, items: '[]' } },
    { name: 'JSON inválido', metadata: { ...testMetadata, items: 'invalid json' } },
    { name: 'precio negativo', metadata: { ...testMetadata, items: JSON.stringify([{ ...testItems[0], price: '-100' }]) } }
  ];

  errorCases.forEach(testCase => {
    try {
      // Simular validaciones del webhook
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

// Ejecutar pruebas
testWebhookDataStructure();
