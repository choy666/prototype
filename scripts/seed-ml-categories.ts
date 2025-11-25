import { db } from '@/lib/db';
import { categories } from '@/lib/schema';
import { MercadoLibreAuth } from '@/lib/auth/mercadolibre';

const ML_OFFICIAL_CATEGORIES = [
  { mlCategoryId: 'MLA1055', name: 'Celulares y Smartphones' },
  { mlCategoryId: 'MLA1652', name: 'Notebooks' },
  { mlCategoryId: 'MLA1002', name: 'Televisores' },
  { mlCategoryId: 'MLA438566', name: 'Consolas' },
  { mlCategoryId: 'MLA398582', name: 'Heladeras' },
  { mlCategoryId: 'MLA1577', name: 'Microondas' },
  { mlCategoryId: 'MLA431202', name: 'Lavarropas y Lavasecarropas' },
  { mlCategoryId: 'MLA1644', name: 'Aires Acondicionados' },
  { mlCategoryId: 'MLA109027', name: 'Zapatillas' },
  { mlCategoryId: 'MLA373770', name: 'Vestidos' },
  { mlCategoryId: 'MLA109042', name: 'Remeras, Musculosas y Chombas' },
  { mlCategoryId: 'MLA1271', name: 'Perfumes' },
  { mlCategoryId: 'MLA43686', name: 'Set de Maquillaje' },
  { mlCategoryId: 'MLA414007', name: 'Shampoos y Acondicionadores' },
  { mlCategoryId: 'MLA31045', name: 'Juegos de Living' },
  { mlCategoryId: 'MLA1611', name: 'Juegos de Sommier y Colchón' },
  { mlCategoryId: 'MLA447782', name: 'Sillas Gamer' },
  { mlCategoryId: 'MLA433672', name: 'Eléctricos' },
  { mlCategoryId: 'MLA6143', name: 'Bicicletas' },
  { mlCategoryId: 'MLA1763', name: 'Motos' },
  { mlCategoryId: 'MLA22195', name: 'Neumáticos de Auto y Camioneta' },
  { mlCategoryId: 'MLA61177', name: 'Pastillas de Freno' },
  { mlCategoryId: 'MLA1161', name: 'Juegos de Mesa y Cartas' },
  { mlCategoryId: 'MLA1386', name: 'Cochecitos para Bebés' },
  { mlCategoryId: 'MLA127684', name: 'Otros (Artículos de limpieza)' },
  { mlCategoryId: 'MLA1087', name: 'Alimentos Balanceados' },
  { mlCategoryId: 'MLA8830', name: 'Suplementos Alimenticios' },
  { mlCategoryId: 'MLA409415', name: 'Asistentes Virtuales' },
  { mlCategoryId: 'MLA8618', name: 'Parlantes Portátiles' },
  { mlCategoryId: 'MLA3697', name: 'Auriculares' },
];

export async function seedMlCategories() {
  console.log('🌱 Seeding ML categories...');
  let created = 0;
  let updated = 0;
  let errors = 0;

  const mlAuth = new MercadoLibreAuth();
  let accessToken: string | undefined;
  try {
    accessToken = await mlAuth.getAccessToken();
  } catch (e) {
    console.warn('⚠️ No se pudo obtener token de ML; se insertará sin validar hoja.');
  }

  for (const cat of ML_OFFICIAL_CATEGORIES) {
    try {
      let isLeaf = false;
      if (accessToken) {
        const res = await fetch(`https://api.mercadolibre.com/categories/${cat.mlCategoryId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          isLeaf = !data.children_categories || data.children_categories.length === 0;
          if (!isLeaf) {
            console.warn(`⚠️ Categoría ${cat.mlCategoryId} no es hoja (tiene hijos). Se marcará como no hoja.`);
          }
        } else {
          console.warn(`⚠️ No se pudo validar categoría ${cat.mlCategoryId}: ${res.status}`);
        }
      }

      await db
        .insert(categories)
        .values({
          name: cat.name,
          mlCategoryId: cat.mlCategoryId,
          isMlOfficial: true,
          isLeaf,
          updated_at: new Date(),
        })
        .onConflictDoUpdate({
          target: categories.mlCategoryId,
          set: {
            name: cat.name,
            isMlOfficial: true,
            isLeaf,
            updated_at: new Date(),
          },
        });

      if (isLeaf) {
        console.log(`✅ Insertada/actualizada categoría hoja: ${cat.mlCategoryId} (${cat.name})`);
      } else {
        console.log(`➕ Insertada/actualizada categoría (no hoja): ${cat.mlCategoryId} (${cat.name})`);
      }
      created += 1;
    } catch (err) {
      console.error(`❌ Error insertando categoría ${cat.mlCategoryId}:`, err);
      errors += 1;
    }
  }

  console.log(`🏁 Seed finalizado. Creadas/actualizadas: ${created}, Errores: ${errors}`);
  return { created, errors };
}

if (require.main === module) {
  seedMlCategories()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
