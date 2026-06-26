'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { X, GripVertical, Upload, ZoomIn } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface ImageReorderProps {
  images: string[]
  onReorder: (images: string[]) => void
  onRemove: (index: number) => void
  onAdd: (imageUrl: string) => void
  maxImages?: number
}

export function ImageReorder({
  images,
  onReorder,
  onRemove,
  onAdd,
  maxImages = 10
}: ImageReorderProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [newImageUrl, setNewImageUrl] = useState('')
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const { toast } = useToast()

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === dropIndex) return

    const newImages = [...images]
    const [draggedImage] = newImages.splice(draggedIndex, 1)
    newImages.splice(dropIndex, 0, draggedImage)

    onReorder(newImages)
    setDraggedIndex(null)
  }

  const handleAddImage = () => {
    if (!newImageUrl.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa una URL de imagen válida',
        variant: 'destructive'
      })
      return
    }

    if (images.length >= maxImages) {
      toast({
        title: 'Error',
        description: `Máximo ${maxImages} imágenes permitidas`,
        variant: 'destructive'
      })
      return
    }

    try {
      new URL(newImageUrl)
      onAdd(newImageUrl.trim())
      setNewImageUrl('')
      toast({
        title: 'Éxito',
        description: 'Imagen agregada correctamente'
      })
    } catch {
      toast({
        title: 'Error',
        description: 'URL de imagen inválida',
        variant: 'destructive'
      })
    }
  }

  const handleImageClick = (image: string) => {
    setPreviewImage(image)
  }

  const closePreview = () => {
    setPreviewImage(null)
  }

  return (
    <>
      <div className="space-y-4">
        {/* Agregar nueva imagen */}
        <div className="flex gap-2">
          <input
            type="url"
            value={newImageUrl}
            onChange={(e) => setNewImageUrl(e.target.value)}
            placeholder="https://ejemplo.com/imagen.jpg"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            onKeyPress={(e) => e.key === 'Enter' && handleAddImage()}
          />
          <Button
            type="button"
            onClick={handleAddImage}
            disabled={!newImageUrl.trim() || images.length >= maxImages}
            className="min-h-[44px]"
          >
            <Upload className="h-4 w-4 mr-2" />
            Agregar
          </Button>
        </div>

        {/* Lista de imágenes - formato vertical como imagen principal */}
        <div className="space-y-3">
          {images.map((image, index) => (
            <div
              key={index}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800 cursor-move hover:shadow-md transition-all duration-200"
            >
              {/* Indicador de orden y grip */}
              <div className="flex flex-col items-center gap-1">
                <GripVertical className="h-4 w-4 text-gray-400" />
                <span className="text-xs font-semibold text-gray-500">{index + 1}</span>
              </div>

              {/* Vista previa de imagen */}
              <div className="relative w-16 h-16 rounded-lg overflow-hidden border flex-shrink-0">
                <Image
                  src={image}
                  alt={`Vista previa de imagen ${index + 1}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
                />
              </div>

              {/* Información de la imagen */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Imagen Adicional {index + 1}</p>
                <p className="text-xs text-muted-foreground truncate max-w-xs">{image}</p>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleImageClick(image)}
                  className="min-h-[32px]"
                >
                  <ZoomIn className="h-3 w-3 mr-1" />
                  Ver
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRemove(index)}
                  className="min-h-[32px] text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {images.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Upload className="mx-auto h-12 w-12 mb-4" />
            <p>No hay imágenes. Agrega la primera imagen arriba.</p>
          </div>
        )}

        {images.length > 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Arrastra las imágenes para reordenarlas. Haz click para ver en tamaño completo.
          </p>
        )}
      </div>

      {/* Modal de previsualización */}
      {previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={closePreview}>
          <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <Image
              src={previewImage}
              alt="Vista previa de imagen"
              width={800}
              height={600}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <button
              onClick={closePreview}
              className="absolute top-4 right-4 bg-white text-black rounded-full p-2 hover:bg-gray-200 transition-colors"
              aria-label="Cerrar vista previa"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
