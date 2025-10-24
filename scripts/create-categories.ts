import { db } from '@/lib/db';
import { categories } from '@/lib/schema';

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

createCategories();
