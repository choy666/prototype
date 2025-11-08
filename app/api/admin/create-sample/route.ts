import { NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { products, categories } from '@/lib/schema'
import { eq, sql } from 'drizzle-orm'
import { logger } from '@/lib/utils/logger'

export async function GET() {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar si el producto 24 existe
    const existingProduct = await db.select().from(products).where(eq(products.id, 24))
    if (existingProduct.length > 0) {
      logger.info('Producto 24 ya existe')
      return NextResponse.json({ message: 'Producto 24 ya existe', product: existingProduct[0] })
    }

    // Verificar o crear categoría
    let categoryId = 1
    const categoriesList = await db.select().from(categories).limit(1)
    if (categoriesList.length === 0) {
      const [newCategory] = await db.insert(categories).values({
        name: 'Electrónicos',
        description: 'Productos electrónicos'
      }).returning()
      categoryId = newCategory.id
    } else {
      categoryId = categoriesList[0].id
    }

    // Set sequence to 23 so next insert gets ID 24
    await db.execute(sql`SELECT setval('products_id_seq', 23, false);`)

    // Crear el producto
    const [newProduct] = await db.insert(products).values({
      name: 'Producto de Prueba',
      description: 'Este es un producto de prueba para la página de stock.',
      price: '99.99',
      image: 'https://via.placeholder.com/300x300?text=Producto+24',
      images: ['https://via.placeholder.com/300x300?text=Producto+24'],
      categoryId,
      category: 'Electrónicos',
      destacado: false,
      stock: 100,
      discount: 0,
      weight: '1.5',
      attributes: {}
    }).returning()

    logger.info('Producto de prueba creado', { productId: newProduct.id })

    return NextResponse.json({ message: 'Producto creado exitosamente', product: newProduct }, { status: 201 })
  } catch (error) {
    logger.error('Error creando producto de prueba', { error: error instanceof Error ? error.message : 'Unknown error' })
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
