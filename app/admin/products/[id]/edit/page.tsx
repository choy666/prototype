'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Tooltip } from '@/components/ui/Tooltip'
import { ArrowLeft, Save, FileText, Tag, Package, Eye, Image as ImageIcon } from 'lucide-react'
import { ImageManager } from '@/components/ui/ImageManager'
import { ProductVariantsNew } from '@/components/admin/ProductVariantsNew'
import { AttributeBuilder } from '@/components/admin/AttributeBuilder'
import type { Category } from '@/lib/schema'
import type { DynamicAttribute } from '@/components/admin/AttributeBuilder'
import type { ProductVariant } from '@/components/admin/ProductVariantsNew'


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
  images: string[]
  categoryId: string
  discount: string
  weight: string
  stock: string
  destacado: boolean
  dynamicAttributes: DynamicAttribute[]
}





export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadingAttributes, setLoadingAttributes] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
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
    dynamicAttributes: []
  })
  const [attributes, setAttributes] = useState<DynamicAttribute[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])

  const [showPreview, setShowPreview] = useState(false)

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

        const initialForm = {
          name: product.name,
          description: product.description || '',
          price: product.price,
          image: product.image || '',
          images: product.images || [],
          categoryId: product.categoryId?.toString() || '',
          discount: product.discount.toString(),
          weight: product.weight || '',
          stock: product.stock.toString(),
          destacado: product.destacado,
          dynamicAttributes: (product as unknown as { attributes?: DynamicAttribute[] }).attributes || [],
          variants: [] // Se cargarán desde ProductVariants
        }

        setForm(initialForm)
        setAttributes((product as unknown as { attributes?: DynamicAttribute[] }).attributes || [])
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
        destacado: form.destacado,
        attributes: attributes.length > 0 ? attributes : undefined
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

  const handleImagesReorder = (images: string[]) => {
    setForm(prev => ({ ...prev, images }))
  }

  const handleUpdateAttributes = async () => {
    setLoadingAttributes(true)

    try {
      const response = await fetch(`/api/admin/products/${id}/attributes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ attributes })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update attributes')
      }

      toast({
        title: 'Éxito',
        description: 'Atributos dinámicos actualizados correctamente'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudieron actualizar los atributos',
        variant: 'destructive'
      })
    } finally {
      setLoadingAttributes(false)
    }
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

      {/* Header with progress and actions */}
      <div className="flex items-center justify-between">
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

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Preview toggle */}
          <Tooltip content="Vista previa">
            <Button
              variant={showPreview ? "default" : "outline"}
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="min-h-[36px]"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>



      {/* Main content with tabs */}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic" className="flex items-center gap-2 transition-all duration-200 hover:scale-105">
            <FileText className="h-4 w-4" />
            Información
          </TabsTrigger>
          <TabsTrigger value="attributes" className="flex items-center gap-2 transition-all duration-200 hover:scale-105">
            <Tag className="h-4 w-4" />
            Atributos
          </TabsTrigger>
          <TabsTrigger value="variants" className="flex items-center gap-2 transition-all duration-200 hover:scale-105">
            <Package className="h-4 w-4" />
            Variantes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="animate-in fade-in slide-in-from-right-2 duration-300">
          <Card className="transition-all duration-300 hover:shadow-lg">
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
                    <Select value={form.categoryId} onValueChange={(value) => handleChange('categoryId', value)} disabled={categoriesLoading}>
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

                  <div>
                    <Label htmlFor="stock">Stock</Label>
                    <Input
                      id="stock"
                      type="number"
                      min="0"
                      value={form.stock}
                      disabled
                      placeholder="0"
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
                    <Label htmlFor="image" className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Imagen Principal (URL)
                    </Label>
                    <div className="space-y-3">
                      <Input
                        id="image"
                        type="url"
                        value={form.image}
                        onChange={(e) => handleChange('image', e.target.value)}
                        placeholder="https://ejemplo.com/imagen.jpg"
                      />
                      {form.image && (
                        <div className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden border">
                            <Image
                              src={form.image}
                              alt="Vista previa de imagen principal"
                              fill
                              sizes="64px"
                              className="object-cover"
                              placeholder="blur"
                              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Imagen Principal</p>
                            <p className="text-xs text-muted-foreground truncate max-w-xs">{form.image}</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(form.image, '_blank')}
                            className="min-h-[32px]"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="images">Imágenes Adicionales</Label>
                    <ImageManager
                      mode="reorder"
                      images={form.images}
                      onImagesChange={handleImagesReorder}
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
          </TabsContent>

          <TabsContent value="attributes" className="animate-in fade-in slide-in-from-right-2 duration-300">
            <Card className="transition-all duration-300 hover:shadow-lg">
              <CardHeader>
                <CardTitle>Atributos Dinámicos</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Define los atributos que tendrán las variantes de este producto
                </p>
              </CardHeader>
              <CardContent>
                <AttributeBuilder
                  attributes={attributes}
                  onChange={setAttributes}
                />
                <div className="flex justify-end mt-6">
                  <Button
                    onClick={handleUpdateAttributes}
                    disabled={loadingAttributes}
                    className="min-h-[44px]"
                  >
                    {loadingAttributes ? 'Actualizando...' : 'Actualizar Atributos Dinámicos'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="variants" className="animate-in fade-in slide-in-from-right-2 duration-300">
            <Card className="transition-all duration-300 hover:shadow-lg">
              <CardHeader>
                <CardTitle>Variantes del Producto</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Gestiona las diferentes combinaciones de atributos y sus configuraciones
                </p>
              </CardHeader>
              <CardContent>
                <ProductVariantsNew
                  productId={parseInt(id)}
                  variants={variants}
                  onChange={setVariants}
                />
              </CardContent>
            </Card>
          </TabsContent>


        </Tabs>

        {/* Preview Section */}
        {showPreview && (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all duration-300 hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Vista Previa del Producto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">{form.name || 'Nombre del producto'}</h3>
                  <p className="text-muted-foreground">{form.description || 'Descripción del producto'}</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${form.price ? parseFloat(form.price).toFixed(2) : '0.00'}
                  </p>
                </div>

                {attributes.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Caracteristicas:</h4>
                    <div className="flex flex-wrap gap-2">
                      {attributes.map((attr, index) => (
                        <div key={index} className="text-sm">
                          <span className="font-medium">{attr.name}:</span>
                          <span className="ml-1 px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            {attr.values.join(', ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }
