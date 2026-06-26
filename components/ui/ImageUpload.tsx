'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { Button } from './Button'
import { Card } from './card'
import Image from 'next/image'
import { useToast } from './use-toast'

interface ImageUploadProps {
  onImagesChange: (images: string[]) => void
  initialImages?: string[]
  maxFiles?: number
  className?: string
}

export function ImageUpload({
  onImagesChange,
  initialImages = [],
  maxFiles = 10,
  className = ''
}: ImageUploadProps) {
  const [images, setImages] = useState<string[]>(initialImages)
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true)
    const newImages: string[] = []

    for (const file of acceptedFiles) {
      if (images.length + newImages.length >= maxFiles) break

      try {
        // Subir imagen a nuestro endpoint local
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const data = await response.json()
          if (data.url) {
            newImages.push(data.url)
          } else {
            throw new Error('No se recibió URL del servidor')
          }
        } else {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Error al subir imagen')
        }
      } catch (error) {
        console.error('Error uploading image:', error)
        // Mostrar error al usuario en lugar de usar fallback
        toast({
          title: 'Error al subir imagen',
          description: error instanceof Error ? error.message : 'No se pudo subir la imagen',
          variant: 'destructive'
        })
      }
    }

    const updatedImages = [...images, ...newImages]
    setImages(updatedImages)
    onImagesChange(updatedImages)
    setUploading(false)
  }, [images, maxFiles, onImagesChange, toast])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    maxFiles: maxFiles - images.length,
    disabled: uploading || images.length >= maxFiles
  })

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    setImages(newImages)
    onImagesChange(newImages)
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-gray-900'
            : 'border-gray-300 hover:border-gray-400'
        } ${uploading || images.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-sm text-gray-600">
          {isDragActive
            ? 'Suelta las imágenes aquí...'
            : uploading
            ? 'Subiendo imágenes...'
            : `Arrastra y suelta imágenes aquí, o haz clic para seleccionar (${images.length}/${maxFiles})`}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          PNG, JPG, GIF hasta 10MB cada una
        </p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <Card key={index} className="relative group">
              <div className="aspect-square relative overflow-hidden rounded-lg">
                <Image
                  src={image}
                  alt={`Imagen subida ${index + 1} para el producto`}
                  fill
                  className="object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  onClick={() => removeImage(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <ImageIcon className="mx-auto h-12 w-12 mb-4" />
          <p>No hay imágenes seleccionadas</p>
        </div>
      )}
    </div>
  )
}
