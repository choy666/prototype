'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { Button } from './Button';
import { Card } from './card';
import { X, Upload, ZoomIn, GripVertical } from 'lucide-react';
import { useToast } from './use-toast';

interface ImageManagerProps {
  mode: 'single' | 'multiple' | 'reorder';
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  uploading?: boolean;
  className?: string;
}

export function ImageManager({
  mode,
  images,
  onImagesChange,
  maxImages = 5,
  uploading = false,
  className = ''
}: ImageManagerProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const handleDrop = useCallback(async (acceptedFiles: File[]) => {
    if (mode === 'single' && acceptedFiles.length > 1) {
      toast({
        title: "Error",
        description: "Solo se permite una imagen en modo individual",
        variant: "destructive"
      });
      return;
    }

    if (images.length + acceptedFiles.length > maxImages) {
      toast({
        title: "Límite excedido",
        description: `Máximo ${maxImages} imágenes permitidas`,
        variant: "destructive"
      });
      return;
    }

    // Subir imágenes al endpoint local
    const uploadPromises = acceptedFiles.map(async (file) => {
      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const data = await response.json()
          return data.url
        } else {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Error al subir imagen')
        }
      } catch (error) {
        console.error('Error uploading image:', error)
        toast({
          title: 'Error al subir imagen',
          description: error instanceof Error ? error.message : 'No se pudo subir la imagen',
          variant: 'destructive'
        })
        return null
      }
    })

    const uploadedUrls = await Promise.all(uploadPromises)
    const validUrls = uploadedUrls.filter((url): url is string => url !== null)
    
    if (mode === 'single') {
      onImagesChange(validUrls);
    } else {
      onImagesChange([...images, ...validUrls]);
    }
  }, [mode, images, maxImages, onImagesChange, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    disabled: uploading || (mode !== 'single' && images.length >= maxImages),
    multiple: mode !== 'single'
  });

  const removeImage = useCallback((index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  }, [images, onImagesChange]);

  const moveImage = useCallback((fromIndex: number, toIndex: number) => {
    if (mode !== 'reorder') return;
    
    const newImages = [...images];
    const [movedImage] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, movedImage);
    onImagesChange(newImages);
  }, [images, mode, onImagesChange]);

  const handleDragStart = (index: number) => {
    if (mode === 'reorder') {
      setDraggedIndex(index);
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (mode === 'reorder' && draggedIndex !== null && draggedIndex !== index) {
      moveImage(draggedIndex, index);
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Área de upload */}
      {(mode === 'single' && images.length === 0) || mode !== 'single' ? (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer
            hover:border-gray-400 transition-colors
            ${uploading || (mode !== 'single' && images.length >= maxImages) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-sm text-gray-600">
            {isDragActive
              ? 'Suelta las imágenes aquí...'
              : `Arrastra imágenes o haz clic para seleccionar (${mode === 'single' ? '1 imagen' : `máx. ${maxImages}`})`
            }
          </p>
        </div>
      ) : null}

      {/* Grid de imágenes */}
      {images.length > 0 && (
        <div className={`
          grid gap-4
          ${mode === 'single' ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}
        `}>
          {images.map((image, index) => (
            <Card
              key={index}
              className={`
                relative group overflow-hidden
                ${mode === 'reorder' ? 'cursor-move' : ''}
              `}
              draggable={mode === 'reorder'}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <div className="aspect-square relative">
                <Image
                  src={image}
                  alt={`Imagen ${index + 1}`}
                  fill
                  className="object-cover"
                />
                
                {/* Overlay con acciones */}
                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPreviewImage(image)}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  
                  {mode === 'reorder' && (
                    <div className="p-2 bg-white rounded">
                      <GripVertical className="h-4 w-4 text-gray-600" />
                    </div>
                  )}
                  
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de preview */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={() => setPreviewImage(null)}>
          <div className="max-w-4xl max-h-4xl p-4">
            <Image
              src={previewImage}
              alt="Vista previa"
              width={1200}
              height={800}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <Button
              type="button"
              variant="secondary"
              className="absolute top-4 right-4"
              onClick={() => setPreviewImage(null)}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageManager;
