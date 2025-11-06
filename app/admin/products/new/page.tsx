'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Save } from 'lucide-react'
import { AttributeBuilder, type DynamicAttribute } from '@/components/admin/AttributeBuilder'
import { ImageReorder } from '@/components/ui/ImageReorder'
import type { Category } from '@/lib/schema'


interface VariantForm {
  attributes: Record<string, string>
  stock: number
  price: string
  image: string
}

interface ProductForm {
  name: string
  description: string
  price: string
  image: string
  images: string[]
  categoryId: string
  discount: string
  weight: string
  stock: string
  destacado: boolean
  dynamicAttributes: DynamicAttribute[]
  variants: VariantForm[]
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
    stock: '0',
    destacado: false,
    dynamicAttributes: [],
    variants: []
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const categoriesRes = await fetch('/api/admin/categories')

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json()
          setCategories(categoriesData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }
    fetchData()
  }, [])

  // Generate combinations when dynamic attributes change
  useEffect(() => {
    const generateCombinations = (dynamicAttrs: DynamicAttribute[]) => {
      if (dynamicAttrs.length === 0) return []

      const combinations = dynamicAttrs.reduce((acc, attr) => {
        const values = attr.value.split(',').map(v => v.trim()).filter(v => v)
        if (acc.length === 0) {
          return values.map((value: string) => ({ [attr.name]: value }))
        }
        return acc.flatMap(comb =>
          values.map((value: string) => ({ ...comb, [attr.name]: value }))
        )
      }, [] as Record<string, string>[])

      return combinations.map(attrs => ({
        attributes: attrs,
        stock: 0,
        price: '',
        image: ''
      }))
    }

    const combinations = generateCombinations(form.dynamicAttributes)
    setForm(prev => ({ ...prev, variants: combinations }))
  }, [form.dynamicAttributes])

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
        stock: parseInt(form.stock) || 0,
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

      const product = await response.json()

      // Create variants if any
      if (form.variants.length > 0) {
        const variantPromises = form.variants.map(variant =>
          fetch(`/api/admin/products/${product.id}/variants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              attributes: variant.attributes,
              stock: variant.stock,
              price: variant.price || undefined,
              image: variant.image || undefined
            })
          })
        )

        await Promise.all(variantPromises)
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

  const handleImagesReorder = (images: string[]) => {
    setForm(prev => ({ ...prev, images }))
  }

  const handleImageRemove = (index: number) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  const handleImageAdd = (imageUrl: string) => {
    setForm(prev => ({
      ...prev,
      images: [...prev.images, imageUrl]
    }))
  }



  const handleVariantChange = (index: number, field: keyof VariantForm, value: string | number) => {
    setForm(prev => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === index ? { ...variant, [field]: value } : variant
      )
    }))
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
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Nombre del producto"
                  required
                />
              </div>

              <div>
                <Label htmlFor="categoryId">Categoría *</Label>
                <Select value={form.categoryId} onValueChange={(value) => handleChange('categoryId', value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="price">Precio *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.price}
                  onChange={(e) => handleChange('price', e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label htmlFor="discount">Descuento (%)</Label>
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  max="100"
                  value={form.discount}
                  onChange={(e) => handleChange('discount', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => handleChange('stock', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="weight">Peso (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.weight}
                  onChange={(e) => handleChange('weight', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Descripción del producto"
                  rows={4}
                  className="resize-y"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="image">Imagen Principal (URL)</Label>
                <Input
                  id="image"
                  type="url"
                  value={form.image}
                  onChange={(e) => handleChange('image', e.target.value)}
                  placeholder="https://ejemplo.com/imagen.jpg"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="images">Imágenes Adicionales</Label>
                <ImageReorder
                  images={form.images}
                  onReorder={handleImagesReorder}
                  onRemove={handleImageRemove}
                  onAdd={handleImageAdd}
                  maxImages={10}
                />
              </div>

              <div className="md:col-span-2 flex items-center">
                <input
                  type="checkbox"
                  id="destacado"
                  checked={form.destacado}
                  onChange={(e) => handleChange('destacado', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="destacado" className="ml-2 block text-sm font-medium">
                  Producto destacado
                </Label>
              </div>
            </div>

            {/* Atributos Dinámicos */}
            <div className="md:col-span-2">
              <AttributeBuilder
                attributes={form.dynamicAttributes}
                onChange={(dynamicAttributes) => setForm(prev => ({ ...prev, dynamicAttributes }))}
              />
            </div>



            {/* Variantes */}
            {form.variants.length > 0 && (
              <div className="md:col-span-2">
                <Label htmlFor="variants">Variantes</Label>
                <div className="space-y-4">
                  {form.variants.map((variant, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                      <div className="font-medium mb-2">
                        {Object.entries(variant.attributes).map(([key, value]) => `${key}: ${value}`).join(', ')}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <Label htmlFor={`variant-stock-${index}`}>Stock</Label>
                          <Input
                            id={`variant-stock-${index}`}
                            type="number"
                            min="0"
                            value={variant.stock}
                            onChange={(e) => handleVariantChange(index, 'stock', parseInt(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`variant-price-${index}`}>Precio (opcional)</Label>
                          <Input
                            id={`variant-price-${index}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={variant.price}
                            onChange={(e) => handleVariantChange(index, 'price', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`variant-image-${index}`}>Imagen (opcional)</Label>
                          <Input
                            id={`variant-image-${index}`}
                            type="url"
                            value={variant.image}
                            onChange={(e) => handleVariantChange(index, 'image', e.target.value)}
                            placeholder="https://ejemplo.com/imagen.jpg"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
