'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ArrowLeft, Save } from 'lucide-react'
import type { Category } from '@/lib/schema'

interface Product {
  id: number
  name: string
  description?: string
  price: string
  image?: string
  images?: string[]
  category: string
  categoryId?: number
  stock: number
  discount: number
  weight?: string
  destacado: boolean
}

interface ProductForm {
  name: string
  description: string
  price: string
  image: string
  images: string
  categoryId: string
  discount: string
  weight: string
  destacado: boolean
}

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [form, setForm] = useState<ProductForm>({
    name: '',
    description: '',
    price: '',
    image: '',
    images: '',
    categoryId: '',
    discount: '0',
    weight: '',
    destacado: false
  })

  const id = params.id as string

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/admin/categories')
        if (!response.ok) throw new Error('Failed to fetch categories')
        const categoriesData: Category[] = await response.json()
        setCategories(categoriesData)
      } catch (error) {
        console.error('Error fetching categories:', error)
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las categorías',
          variant: 'destructive'
        })
      } finally {
        setCategoriesLoading(false)
      }
    }

    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/admin/products/${id}`)
        if (!response.ok) throw new Error('Failed to fetch product')
        const product: Product = await response.json()

        setForm({
          name: product.name,
          description: product.description || '',
          price: product.price,
          image: product.image || '',
          images: product.images ? product.images.join(', ') : '',
          categoryId: product.categoryId?.toString() || '',
          discount: product.discount.toString(),
          weight: product.weight || '',
          destacado: product.destacado
        })
      } catch {
        toast({
          title: 'Error',
          description: 'No se pudo cargar el producto',
          variant: 'destructive'
        })
        router.push('/admin/products')
      } finally {
        setFetchLoading(false)
      }
    }

    fetchCategories()
    if (id) fetchProduct()
  }, [id, router, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const imagesArray = form.images
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0)

      const productData = {
        name: form.name,
        description: form.description || undefined,
        price: form.price,
        image: form.image || undefined,
        images: imagesArray,
        categoryId: parseInt(form.categoryId),
        discount: parseInt(form.discount),
        weight: form.weight || undefined,
        destacado: form.destacado
      }

      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update product')
      }

      toast({
        title: 'Éxito',
        description: 'Producto actualizado correctamente'
      })

      router.push('/admin/products')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo actualizar el producto',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof ProductForm, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  if (fetchLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-24" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'Productos', href: '/admin/products' },
        { label: 'Editar Producto' }
      ]} />
      <div className="flex items-center space-x-4">
        <Link href="/admin/products">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Producto</h1>
          <p className="text-muted-foreground">
            Modifica la información del producto
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del Producto</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Nombre *</label>
                <Input
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Nombre del producto"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Categoría *</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => handleChange('categoryId', e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                  required
                  disabled={categoriesLoading}
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id.toString()}>
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
                  className="min-h-[44px]"
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
                  className="min-h-[44px]"
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
                  className="min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Descripción</label>
              <textarea
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Descripción del producto"
                className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                rows={4}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Imagen Principal (URL)</label>
              <Input
                type="url"
                value={form.image}
                onChange={(e) => handleChange('image', e.target.value)}
                placeholder="https://ejemplo.com/imagen.jpg"
                className="min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Imágenes Adicionales (URLs separadas por coma)</label>
              <Input
                value={form.images}
                onChange={(e) => handleChange('images', e.target.value)}
                placeholder="https://ejemplo.com/img1.jpg, https://ejemplo.com/img2.jpg"
                className="min-h-[44px]"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="destacado"
                checked={form.destacado}
                onChange={(e) => handleChange('destacado', e.target.checked)}
                className="rounded w-5 h-5 min-h-[44px] min-w-[44px]"
              />
              <label htmlFor="destacado" className="text-sm font-medium">
                Producto destacado
              </label>
            </div>

            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-4">
              <Link href="/admin/products">
                <Button type="button" variant="outline" className="w-full sm:w-auto min-h-[44px]">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto min-h-[44px]">
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Actualizando...' : 'Actualizar Producto'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
