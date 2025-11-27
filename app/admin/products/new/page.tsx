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
import { MLCategorySelectSimple } from '@/components/admin/MLCategorySelectSimple'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Save } from 'lucide-react'

import { ImageManager } from '@/components/ui/ImageManager'
import type { Category } from '@/lib/schema'
import { AttributeBuilder } from '@/components/admin/AttributeBuilder'
import type { DynamicAttribute } from '@/components/admin/AttributeBuilder'


interface ProductForm {
  name: string
  description: string
  price: string
  image: string
  images: string[]
  discount: string
  weight: string
  stock: string
  destacado: boolean
  // Campos obligatorios de Mercado Libre
  mlCondition: string
  mlBuyingMode: string
  mlListingTypeId: string
  mlCurrencyId: string
  mlCategoryId: string
  warranty: string
  videoId: string
  // Dimensiones para envío
  height: string
  width: string
  length: string
}

type RecommendedAttributeConfig = {
  key: string
  label: string
  aliases: string[]
  required?: boolean
}

interface ListingTypeConfig {
  id: string
  name: string
  saleFeePercent: number
  currency: string
}

export default function NewProductPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [attributes, setAttributes] = useState<DynamicAttribute[]>([])
  const [recommendedAttributes, setRecommendedAttributes] = useState<RecommendedAttributeConfig[]>([])
  const [listingTypes, setListingTypes] = useState<ListingTypeConfig[]>([])

  const [form, setForm] = useState<ProductForm>({
    name: '',
    description: '',
    price: '',
    image: '',
    images: [],
    discount: '0',
    weight: '',
    stock: '0',
    destacado: false,
    // Valores por defecto para Mercado Libre
    mlCondition: 'new',
    mlBuyingMode: 'buy_it_now',
    mlListingTypeId: 'free',
    mlCurrencyId: 'ARS',
    mlCategoryId: '',
    warranty: '',
    videoId: '',
    // Dimensiones
    height: '',
    width: '',
    length: ''
  })

  const mlCategories = categories.filter(
    (category) => category.mlCategoryId && category.isMlOfficial && category.isLeaf
  )

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

  useEffect(() => {
    const fetchListingTypes = async () => {
      try {
        const res = await fetch('/api/mercadolibre/listing-types')
        if (!res.ok) return

        const data = await res.json()
        const types = Array.isArray(data.listingTypes) ? data.listingTypes : []
        setListingTypes(types)
      } catch (error) {
        console.error('Error fetching listing types:', error)
      }
    }

    fetchListingTypes()
  }, [])

  useEffect(() => {
    const fetchRecommendedAttributes = async () => {
      if (!form.mlCategoryId) {
        setRecommendedAttributes([])
        return
      }

      try {
        const res = await fetch(`/api/mercadolibre/categories/${form.mlCategoryId}/attributes`)
        if (!res.ok) {
          setRecommendedAttributes([])
          return
        }
        const data = await res.json()
        setRecommendedAttributes(data.attributes || [])
      } catch {
        setRecommendedAttributes([])
      }
    }

    fetchRecommendedAttributes()
  }, [form.mlCategoryId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (mlCategories.length === 0) {
        throw new Error('No hay categorías oficiales de Mercado Libre. Ve a "Categorías" y usa "Actualizar desde Mercado Libre".')
      }

      if (!form.mlCategoryId) {
        throw new Error('Debes seleccionar una categoría de Mercado Libre')
      }

      const productData = {
        name: form.name,
        description: form.description || undefined,
        price: form.price,
        image: form.image || undefined,
        images: form.images,
        discount: parseInt(form.discount),
        weight: form.weight || undefined,
        stock: parseInt(form.stock) || 0,
        destacado: form.destacado,
        // Campos de Mercado Libre
        mlCondition: form.mlCondition,
        mlBuyingMode: form.mlBuyingMode,
        mlListingTypeId: form.mlListingTypeId,
        mlCurrencyId: form.mlCurrencyId,
        mlCategoryId: form.mlCategoryId,
        warranty: form.warranty || undefined,
        mlVideoId: form.videoId || undefined,
        // Dimensiones para envío
        height: form.height || undefined,
        width: form.width || undefined,
        length: form.length || undefined,
        attributes: attributes.length > 0 ? attributes : undefined,
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

  const handleImagesReorder = (images: string[]) => {
    setForm(prev => ({ ...prev, images }))
  }

  const handleMlCategoryChange = (mlCategoryId: string) => {
    setForm(prev => ({
      ...prev,
      mlCategoryId,
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
                <Label htmlFor="mlCategoryId">Categoría Mercado Libre *</Label>
                <MLCategorySelectSimple
                  value={form.mlCategoryId}
                  onValueChange={handleMlCategoryChange}
                  categories={categories}
                  placeholder="Seleccionar categoría ML"
                  disabled={mlCategories.length === 0}
                />
                {mlCategories.length === 0 && (
                  <p className="mt-2 text-sm text-orange-600">
                    No hay categorías oficiales de Mercado Libre configuradas. Ve a la sección Categorías y usa el botón Actualizar desde Mercado Libre antes de crear productos.
                  </p>
                )}
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

              <div className="md:col-span-2">
                <Label htmlFor="warranty">Garantía</Label>
                <Input
                  id="warranty"
                  value={form.warranty}
                  onChange={(e) => handleChange('warranty', e.target.value)}
                  placeholder="Ej: 90 días, 1 año, sin garantía"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="videoId">ID de Video (YouTube, Vimeo)</Label>
                <Input
                  id="videoId"
                  value={form.videoId}
                  onChange={(e) => handleChange('videoId', e.target.value)}
                  placeholder="ID del video para mostrar en la publicación"
                />
              </div>

              <div>
                <Label htmlFor="height">Alto (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.height}
                  onChange={(e) => handleChange('height', e.target.value)}
                  placeholder="0.0"
                />
              </div>

              <div>
                <Label htmlFor="width">Ancho (cm)</Label>
                <Input
                  id="width"
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.width}
                  onChange={(e) => handleChange('width', e.target.value)}
                  placeholder="0.0"
                />
              </div>

              <div>
                <Label htmlFor="length">Largo (cm)</Label>
                <Input
                  id="length"
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.length}
                  onChange={(e) => handleChange('length', e.target.value)}
                  placeholder="0.0"
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

              <div>
                <Label htmlFor="mlCondition">Condición *</Label>
                <Select value={form.mlCondition} onValueChange={(value) => handleChange('mlCondition', value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar condición" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Nuevo</SelectItem>
                    <SelectItem value="used">Usado</SelectItem>
                    <SelectItem value="not_specified">No especificado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="mlBuyingMode">Modalidad de compra *</Label>
                <Select value={form.mlBuyingMode} onValueChange={(value) => handleChange('mlBuyingMode', value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar modalidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy_it_now">Comprar ahora</SelectItem>
                    <SelectItem value="auction">Subasta</SelectItem>
                    <SelectItem value="classified">Clasificado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="mlListingTypeId">Tipo de publicación *</Label>
                <Select value={form.mlListingTypeId} onValueChange={(value) => handleChange('mlListingTypeId', value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {listingTypes.length > 0 ? (
                      listingTypes.map((lt) => {
                        const baseLabel =
                          lt.id === 'free'
                            ? 'Gratuita (Free)'
                            : lt.id === 'gold_special'
                            ? 'Gold Special (Premium)'
                            : lt.name

                        const feeLabel =
                          typeof lt.saleFeePercent === 'number'
                            ? `${lt.saleFeePercent}%`
                            : 'N/D'

                        return (
                          <SelectItem key={lt.id} value={lt.id}>
                            {`${baseLabel} – Comisión ${feeLabel}`}
                          </SelectItem>
                        )
                      })
                    ) : (
                      <>
                        <SelectItem value="free">Gratuita (Free)</SelectItem>
                        <SelectItem value="gold_special">Gold Special (Premium)</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="mlCurrencyId">Moneda *</Label>
                <Select value={form.mlCurrencyId} onValueChange={(value) => handleChange('mlCurrencyId', value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS - Pesos Argentinos</SelectItem>
                    <SelectItem value="USD">USD - Dólares Estadounidenses</SelectItem>
                    <SelectItem value="UYU">UYU - Pesos Uruguayos</SelectItem>
                    <SelectItem value="CLP">CLP - Pesos Chilenos</SelectItem>
                    <SelectItem value="COP">COP - Pesos Colombianos</SelectItem>
                    <SelectItem value="MXN">MXN - Pesos Mexicanos</SelectItem>
                    <SelectItem value="PEN">PEN - Soles Peruanos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="image">Imagen Principal</Label>
                <ImageManager
                  mode="single"
                  images={form.image ? [form.image] : []}
                  onImagesChange={(images) => setForm(prev => ({ ...prev, image: images[0] || '' }))}
                  maxImages={1}
                />
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

      <Card>
        <CardHeader>
          <CardTitle>Atributos del Producto</CardTitle>
        </CardHeader>
        <CardContent>
          <AttributeBuilder
            attributes={attributes}
            onChange={setAttributes}
            recommendedAttributes={recommendedAttributes}
          />
        </CardContent>
      </Card>
    </div>
  )
}
