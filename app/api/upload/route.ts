import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'
import { auth } from '@/lib/actions/auth'

// Extensiones permitidas
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Función para sanitizar el nombre del archivo
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_')
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo' }, { status: 400 })
    }

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'El archivo debe ser una imagen' }, { status: 400 })
    }

    // Validar extensión
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json({ 
        error: `Extensión no permitida. Use: ${ALLOWED_EXTENSIONS.join(', ')}` 
      }, { status: 400 })
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `El archivo es demasiado grande (máximo ${MAX_FILE_SIZE / 1024 / 1024}MB)` 
      }, { status: 400 })
    }

    // Generar nombre de archivo seguro y único
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const sanitizedName = sanitizeFilename(file.name.split('.')[0])
    const filename = `products/${timestamp}-${randomString}-${sanitizedName}${fileExtension}`
    
    // Subir a Vercel Blob
    const blob = await put(filename, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    console.log(`Imagen subida a Blob: ${blob.url} por usuario: ${session.user?.email || 'desconocido'}`)
    
    return NextResponse.json({ 
      success: true, 
      url: blob.url,
      filename: filename
    })

  } catch (error) {
    console.error('Error al subir imagen:', error)
    return NextResponse.json({ 
      error: 'Error al procesar la imagen' 
    }, { status: 500 })
  }
}

// Endpoint para eliminar imágenes
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json({ error: 'URL no proporcionada' }, { status: 400 })
    }

    // Solo eliminar URLs de Blob (no locales)
    if (url.startsWith('https://')) {
      await del(url)
      console.log(`Imagen eliminada de Blob: ${url}`)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error al eliminar imagen:', error)
    return NextResponse.json({ 
      error: 'Error al eliminar la imagen' 
    }, { status: 500 })
  }
}
