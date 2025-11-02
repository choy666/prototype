import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { createProductVariant, getProductVariants, getProductImagesForVariant } from '@/lib/actions/productVariants'
import { z } from 'zod'

const createVariantSchema = z.object({
  attributes: z.record(z.string(), z.string()), // { "Talla": "M", "Color": "Rojo" }
  stock: z.number().min(0).default(0),
  price: z.string().optional(), // precio específico opcional
  image: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const productId = parseInt(id)
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
    }

    // Verificar si es una petición para sugerencias de imágenes
    const url = new URL(request.url)
    const isSuggestions = url.searchParams.get('suggestions') === 'true'

    if (isSuggestions) {
      const images = await getProductImagesForVariant(productId)
      return NextResponse.json({ images })
    }

    const variants = await getProductVariants(productId)
    return NextResponse.json(variants)
  } catch (error) {
    console.error('Error fetching product variants:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const productId = parseInt(id)
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
    }

    const body = await request.json()
    const validatedData = createVariantSchema.parse(body)

    // Si no se proporciona imagen, sugerir la primera imagen disponible del producto
    let image = validatedData.image
    if (!image) {
      const availableImages = await getProductImagesForVariant(productId)
      if (availableImages.length > 0) {
        image = availableImages[0] // Sugerir la primera imagen
      }
    }

    // Mantener price como string para coincidir con el schema
    const variantData = {
      productId,
      attributes: validatedData.attributes,
      stock: validatedData.stock,
      price: validatedData.price,
      image,
    }

    const variant = await createProductVariant(variantData)
    return NextResponse.json(variant, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', issues: error.issues }, { status: 400 })
    }
    console.error('Error creating product variant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
