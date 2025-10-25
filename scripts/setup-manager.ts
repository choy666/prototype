#!/usr/bin/env tsx

import { db } from '../lib/db';
import { categories, shippingMethods } from '../lib/schema';

async function createCategories() {
  try {
    console.log('Creando categorías...');

    const categoryList = [
      {
        name: 'Electrónica',
        description: 'Productos electrónicos y gadgets',
      },
      {
        name: 'Ropa',
        description: 'Ropa y accesorios de moda',
      },
      {
        name: 'Hogar',
        description: 'Artículos para el hogar y decoración',
      },
      {
        name: 'Deportes',
        description: 'Equipamiento deportivo y fitness',
      },
      {
        name: 'Libros',
        description: 'Libros y material educativo',
      },
      {
        name: 'Juguetes',
        description: 'Juguetes y juegos para niños',
      },
    ];

    for (const category of categoryList) {
      await db.insert(categories).values(category);
      console.log(`✅ Categoría "${category.name}" creada`);
    }

    console.log('🎉 Todas las categorías han sido creadas exitosamente!');
  } catch (error) {
    console.error('❌ Error creando categorías:', error);
    process.exit(1);
  }
}

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

async function setupAll() {
  console.log('🚀 Iniciando configuración completa...\n');

  await createCategories();
  console.log();
  await createShippingMethods();

  console.log('\n✅ Configuración completada exitosamente!');
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'categories':
      await createCategories();
      break;
    case 'shipping':
      await createShippingMethods();
      break;
    case 'all':
      await setupAll();
      break;
    default:
      console.log('Uso: tsx setup-manager.ts [categories|shipping|all]');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { createCategories, createShippingMethods, setupAll };
