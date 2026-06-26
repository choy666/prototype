/**
 * Helper para manejar URLs de imágenes durante la transición de local a Vercel Blob
 */

export function isBlobUrl(url: string): boolean {
  return url.startsWith('https://')
}

export function isLocalUrl(url: string): boolean {
  return url.startsWith('/uploads/')
}

export function getDisplayUrl(url: string): string {
  // Si ya es URL completa (Blob), retornar tal cual
  if (isBlobUrl(url)) {
    return url
  }
  
  // Si es URL local, asegurarse que tenga el formato correcto
  if (isLocalUrl(url)) {
    return url
  }
  
  // Fallback para URLs vacías o inválidas
  return url || ''
}

export async function deleteImage(url: string): Promise<void> {
  if (isBlobUrl(url)) {
    // Eliminar de Vercel Blob
    try {
      const response = await fetch(`/api/upload?url=${encodeURIComponent(url)}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        console.warn('No se pudo eliminar imagen de Blob:', url)
      }
    } catch (error) {
      console.warn('Error al eliminar imagen de Blob:', error)
    }
  }
  // Las URLs locales no se eliminan (son read-only en producción)
}

export function getImageType(url: string): 'blob' | 'local' | 'unknown' {
  if (isBlobUrl(url)) return 'blob'
  if (isLocalUrl(url)) return 'local'
  return 'unknown'
}
