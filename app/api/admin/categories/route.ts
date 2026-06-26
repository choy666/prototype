import { NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { getCategories, createCategory } from '@/lib/actions/categories'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const onlyLeaf = searchParams.get('onlyLeaf') !== 'false' // Por defecto true

    const categories = await getCategories(search || undefined, onlyLeaf)
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const category = await createCategory({
      name: name.trim(),
      description: description?.trim(),
      mlCategoryId: null, // Categoría local, no de ML
      isMlOfficial: false,
      isLeaf: true
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
