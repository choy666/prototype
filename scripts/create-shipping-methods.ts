import { db } from '@/lib/db';
import { shippingMethods } from '@/lib/schema';

async function createShippingMethods() {
  try {
    console.log('Creando métodos de envío...');

    const methods = [
      {
        name: 'Envío Estándar',
        baseCost: '500.00', // $500 ARS
        weightMultiplier: '50.00', // $50 por kg
        zoneMultiplier: '1.00',
        freeThreshold: '5000.00', // Envío gratis en compras > $5000
        isActive: true,
      },
      {
        name: 'Envío Express',
        baseCost: '800.00', // $800 ARS
        weightMultiplier: '80.00', // $80 por kg
        zoneMultiplier: '1.00',
        freeThreshold: null, // No tiene envío gratis
        isActive: true,
      },
      {
        name: 'Envío Premium',
        baseCost: '1200.00', // $1200 ARS
        weightMultiplier: '100.00', // $100 por kg
        zoneMultiplier: '1.00',
        freeThreshold: '10000.00', // Envío gratis en compras > $10000
        isActive: true,
      },
    ];

    for (const method of methods) {
      await db.insert(shippingMethods).values(method);
      console.log(`✅ Método "${method.name}" creado`);
    }

    console.log('🎉 Todos los métodos de envío han sido creados exitosamente!');
  } catch (error) {
    console.error('❌ Error creando métodos de envío:', error);
    process.exit(1);
  }
}

createShippingMethods();
