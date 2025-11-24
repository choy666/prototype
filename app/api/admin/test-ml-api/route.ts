import { NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'

export async function GET() {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Test 1: Fetch simple sin autenticación (endpoint público)
    console.log('🔄 Testing public ML API...')
    const publicResponse = await fetch('https://api.mercadolibre.com/sites/MLA/categories')
    
    const result: any = {
      publicApi: {
        url: 'https://api.mercadolibre.com/sites/MLA/categories',
        status: publicResponse.status,
        statusText: publicResponse.statusText,
        ok: publicResponse.ok,
        headers: Object.fromEntries(publicResponse.headers.entries())
      }
    }

    if (!publicResponse.ok) {
      const errorText = await publicResponse.text()
      result.publicApi.error = errorText
      console.error('❌ Public API Error:', errorText)
    } else {
      const data = await publicResponse.json()
      result.publicApi.categoriesCount = data.length
      console.log(`✅ Public API OK: ${data.length} categories`)
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Test ML API Error:', error)
    return NextResponse.json({ 
      error: 'Error testing ML API',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
