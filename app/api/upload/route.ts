import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import { existsSync } from 'fs'
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
    const fileExtension = extname(file.name).toLowerCase()
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

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Crear directorio de uploads si no existe
    const uploadDir = join(process.cwd(), 'public', 'uploads')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generar nombre de archivo seguro y único
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const sanitizedName = sanitizeFilename(file.name.split('.')[0])
    const filename = `${timestamp}-${randomString}-${sanitizedName}${fileExtension}`
    
    // Guardar archivo
    const filepath = join(uploadDir, filename)
    await writeFile(filepath, buffer)

    // Retornar URL pública
    const publicUrl = `/uploads/${filename}`
    
    console.log(`Imagen subida: ${filename} por usuario: ${session.user?.email || 'desconocido'}`)
    
    return NextResponse.json({ 
      success: true, 
      url: publicUrl,
      filename: filename
    })

  } catch (error) {
    console.error('Error al subir imagen:', error)
    return NextResponse.json({ 
      error: 'Error al procesar la imagen' 
    }, { status: 500 })
  }
}
