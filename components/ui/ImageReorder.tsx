'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { X, GripVertical, Upload } from 'lucide-react'
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

  return (
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

      {/* Lista de imágenes */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image, index) => (
          <div
            key={index}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            className="relative group border border-gray-200 rounded-lg overflow-hidden cursor-move hover:shadow-md transition-shadow"
          >
            <div className="aspect-square relative">
              <Image
                src={image}
                alt={`Imagen ${index + 1}`}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                <GripVertical className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Botón eliminar */}
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              aria-label={`Eliminar imagen ${index + 1}`}
            >
              <X className="h-4 w-4" />
            </button>

            {/* Indicador de orden */}
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
              {index + 1}
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
          Arrastra las imágenes para reordenarlas. Mantén presionado y arrastra a la nueva posición.
        </p>
      )}
    </div>
  )
}
