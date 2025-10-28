'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Save } from 'lucide-react'
import type { Category } from '@/lib/schema'

interface ProductForm {
  name: string
  description: string
  price: string
  image: string
  images: string[]
  categoryId: string
  discount: string
  weight: string
  destacado: boolean
}

export default function NewProductPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState<ProductForm>({
    name: '',
    description: '',
    price: '',
    image: '',
    images: [],
    categoryId: '',
    discount: '0',
    weight: '',
    destacado: false
  })

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/admin/categories')
        if (response.ok) {
          const data = await response.json()
          setCategories(data)
        }
      } catch (error) {
        console.error('Error fetching categories:', error)
      }
    }
    fetchCategories()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const productData = {
        name: form.name,
        description: form.description || undefined,
        price: form.price,
        image: form.image || undefined,
        images: form.images,
        categoryId: parseInt(form.categoryId),
        discount: parseInt(form.discount),
        weight: form.weight || undefined,
        destacado: form.destacado
      }

      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create product')
      }

      toast({
        title: 'Éxito',
        description: 'Producto creado correctamente'
      })

      router.push('/admin/products')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo crear el producto',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof ProductForm, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/admin/products">
          <Button variant="outline" size="sm" className="min-h-[44px]">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo Producto</h1>
          <p className="text-muted-foreground">
            Crea un nuevo producto para tu catálogo
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Producto</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Nombre *</label>
                <Input
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Nombre del producto"
                  required
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Categoría *</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => handleChange('categoryId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white min-h-[44px]"
                  required
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Precio *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.price}
                  onChange={(e) => handleChange('price', e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Descuento (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={form.discount}
                  onChange={(e) => handleChange('discount', e.target.value)}
                  placeholder="0"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Peso (kg)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  placeholder="0.00"
                  className="w-full"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Descripción del producto"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white min-h-[100px] resize-y"
                  rows={4}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Imagen Principal (URL)</label>
                <Input
                  type="url"
                  value={form.image}
                  onChange={(e) => handleChange('image', e.target.value)}
                  placeholder="https://ejemplo.com/imagen.jpg"
                  className="w-full"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Imágenes Adicionales (URLs separadas por coma)</label>
                <Input
                  value={form.images}
                  onChange={(e) => handleChange('images', e.target.value)}
                  placeholder="https://ejemplo.com/img1.jpg, https://ejemplo.com/img2.jpg"
                  className="w-full"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="destacado"
                    checked={form.destacado}
                    onChange={(e) => handleChange('destacado', e.target.checked)}
                    className="rounded border-gray-300 focus:ring-blue-500 min-h-[44px] min-w-[44px]"
                  />
                  <span className="text-sm font-medium">Producto destacado</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-4">
              <Link href="/admin/products">
                <Button type="button" variant="outline" className="w-full sm:w-auto min-h-[44px]">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto min-h-[44px]">
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Creando...' : 'Crear Producto'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
