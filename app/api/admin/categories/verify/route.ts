import { NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { makeAuthenticatedRequest } from '@/lib/auth/mercadolibre'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { categoryId } = await request.json()
    
    if (!categoryId) {
      return NextResponse.json({ error: 'Se requiere categoryId' }, { status: 400 })
    }

    // Verificar categoría en API de ML
    const response = await makeAuthenticatedRequest(
      parseInt(session.user.id),
      `/categories/${categoryId}`
    )
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`)
    }
    
    const categoryData = await response.json()
    
    // Obtener categoría de BD para comparar
    const { db } = await import('@/lib/db')
    const localCategory = await db.query.categories.findFirst({
      where: (categories, { eq }) => eq(categories.mlCategoryId, categoryId)
    })

    return NextResponse.json({
      categoryId,
      apiData: {
        id: categoryData.id,
        name: categoryData.name,
        path_from_root: categoryData.path_from_root?.map((p: { name: string }) => p.name),
        leaf_category: categoryData.settings?.leaf_category,
        buying_modes: categoryData.settings?.buying_modes,
        listing_allowed: categoryData.settings?.listing_allowed
      },
      localData: localCategory ? {
        id: localCategory.id,
        name: localCategory.name,
        mlCategoryId: localCategory.mlCategoryId,
        isMlOfficial: localCategory.isMlOfficial,
        isLeaf: localCategory.isLeaf
      } : null,
      isDesynced: localCategory ? 
        localCategory.isLeaf !== categoryData.settings?.leaf_category : 
        true
    })

  } catch (error) {
    console.error('Error verificando categoría:', error)
    return NextResponse.json({ 
      error: 'Error al verificar categoría',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
