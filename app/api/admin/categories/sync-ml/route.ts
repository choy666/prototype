import { NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { syncMLCategories } from '@/lib/actions/categories'

export async function POST() {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results = await syncMLCategories()

    return NextResponse.json({
      message: 'Sincronización completada',
      results
    })

  } catch (error) {
    console.error('Error syncing ML categories:', error)
    return NextResponse.json({ 
      error: 'Error al sincronizar categorías de Mercado Libre',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
