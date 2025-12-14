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
import { 
  ArrowLeft, 
  Save, 
  Package, 
  Tag, 
  CheckCircle, 
  AlertCircle,
  Camera,
  Truck,
  Star,
  AlertTriangle,
  CheckSquare,
  Square
} from 'lucide-react'

import { ImageManager } from '@/components/ui/ImageManager'
import { ME2Guidelines } from '@/components/admin/ME2Guidelines'
import { MLAttributesGuide } from '@/components/admin/MLAttributesGuide'
import { AttributeBuilder } from '@/components/admin/AttributeBuilder'
import { getValidations, isME2Ready, type ProductForm, type DynamicAttribute } from '@/lib/validations/product-validations'
import type { Category } from '@/lib/schema'


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
  const [listingTypes, setListingTypes] = useState<ListingTypeConfig[]>([])
  const [focusedSection, setFocusedSection] = useState<string>('')
  const [attributes, setAttributes] = useState<DynamicAttribute[]>([])
  const [recommendedAttributes, setRecommendedAttributes] = useState<{ key: string; label: string; aliases: string[]; required?: boolean }[]>([])

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
    length: '',
    // Nuevos campos ME2
    me2Compatible: false,
    shippingMode: 'me2',
    dynamicAttributes: attributes
  })

  const mlCategories = categories.filter(
    (category) => category.mlCategoryId && category.isMlOfficial && category.isLeaf
  )

  const validations = getValidations(form, attributes, recommendedAttributes)
  const requiredValidations = validations.filter(v => v.isRequired).length
  const completedRequired = validations.filter(v => v.isRequired && v.isValid).length
  const readinessScore = Math.round((completedRequired / requiredValidations) * 100)

  const getReadinessColor = () => {
    if (readinessScore === 100) return 'text-emerald-400 bg-emerald-950/50 border-emerald-800/50'
    if (readinessScore >= 70) return 'text-amber-400 bg-amber-950/50 border-amber-800/50'
    return 'text-red-400 bg-red-950/50 border-red-800/50'
  }

  const getReadinessIcon = () => {
    if (readinessScore === 100) return <CheckCircle className="h-5 w-5" />
    if (readinessScore >= 70) return <AlertTriangle className="h-5 w-5" />
    return <AlertCircle className="h-5 w-5" />
  }

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

      if (readinessScore < 100) {
        throw new Error('Completa todos los campos obligatorios antes de crear el producto')
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
        attributes: attributes.length > 0 ? attributes : undefined,
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
        // Campos ME2
        me2Compatible: isME2Ready(form),
        shippingMode: form.shippingMode,
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
        title: '¡Producto creado! 🎉',
        description: 'El producto está listo para sincronizarse con Mercado Libre. Todos los requisitos han sido cumplidos.'
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
    setForm((prev: ProductForm) => ({ ...prev, [field]: value }))
  }

  const handleImagesReorder = (images: string[]) => {
    setForm((prev: ProductForm) => ({ ...prev, images }))
  }

  const handleMlCategoryChange = (categoryId: string) => {
    const category = categories.find((category) => category.id.toString() === categoryId)
    if (category) {
      setForm((prev: ProductForm) => ({
        ...prev,
        mlCategoryId: category.mlCategoryId || categoryId, // Usar mlCategoryId si existe, sino el categoryId
        mlCondition: 'new', // Valores por defecto ya que no existen en el tipo Category
        mlBuyingMode: 'buy_it_now',
        mlListingTypeId: 'free',
        mlCurrencyId: 'ARS'
      }))
    } else {
      setForm((prev: ProductForm) => ({ ...prev, mlCategoryId: categoryId }))
    }
  }

  // Scroll to section
  const scrollToSection = (sectionId: string) => {
    setFocusedSection(sectionId)
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  return (
    <div className="min-h-screen bg-dark dark:bg-dark">
      {/* Header con indicador de progreso */}
      <div className="sticky top-0 z-40 bg-dark/95 backdrop-blur supports-[backdrop-filter]:bg-dark/60 border-b border-dark-lighter">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/admin/products">
                <Button variant="ghost" size="sm" className="lg:hidden">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-dark-text-primary">Crear Producto</h1>
                <p className="text-sm text-dark-text-secondary">Completa todos los requisitos para Mercado Libre</p>
              </div>
            </div>
            
            {/* Indicator de progreso */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${getReadinessColor()}`}>
              {getReadinessIcon()}
              <div className="text-right">
                <div className="text-sm font-medium">{readinessScore}% Completo</div>
                <div className="text-xs opacity-75">{completedRequired}/{requiredValidations} obligatorios</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar con checklist */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 bg-dark-lighter border-dark-lighter">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-dark-text-primary">
                  <CheckSquare className="h-5 w-5" />
                  Checklist ML
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {validations.map((validation) => (
                  <div
                    key={validation.field}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer
                      ${validation.isValid ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-800/30' : 'bg-dark-lightest text-dark-text-secondary border border-dark-lighter'}
                      ${focusedSection === validation.field ? 'ring-2 ring-blue-500' : ''}
                    `}
                    onClick={() => scrollToSection(validation.field)}
                  >
                    {validation.isValid ? (
                      <CheckSquare className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 flex-shrink-0" />
                    )}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {validation.icon}
                      <span className="text-sm font-medium truncate">
                        {validation.label}
                      </span>
                    </div>
                    {validation.isRequired && (
                      <span className="text-xs bg-red-950/50 text-red-400 px-2 py-0.5 rounded border border-red-800/30">
                        Req
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Formulario principal */}
          <div className="lg:col-span-3 space-y-8">
            {/* Sección Información Básica */}
            <Card id="name" className={`transition-all bg-dark-lighter border-dark-lighter ${focusedSection === 'name' || focusedSection === 'description' || focusedSection === 'price' ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : ''}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-dark-text-primary">
                  <Package className="h-5 w-5" />
                  Información Básica
                  <span className="text-sm font-normal text-dark-text-secondary">(Obligatorio)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="name" className="flex items-center gap-2 text-dark-text-primary">
                    Nombre del producto *
                    {form.name.trim().length >= 3 ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-400" />
                    )}
                  </Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Ej: Smartphone Samsung Galaxy A54 128GB"
                    required
                    className={`mt-1 ${form.name.trim().length >= 3 ? 'border-emerald-500' : ''}`}
                  />
                  <p className="text-xs text-dark-text-secondary mt-1">
                    Mínimo 3 caracteres. Sé específico y descriptivo.
                  </p>
                </div>

                <div>
                  <Label htmlFor="price" className="flex items-center gap-2 text-dark-text-primary">
                    Precio *
                    {parseFloat(form.price) > 0 ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-400" />
                    )}
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.price}
                    onChange={(e) => handleChange('price', e.target.value)}
                    placeholder="0.00"
                    required
                    className={`mt-1 ${parseFloat(form.price) > 0 ? 'border-emerald-500' : ''}`}
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="flex items-center gap-2 text-dark-text-primary">
                    Descripción *
                    {form.description.trim().length >= 50 ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <span className="text-xs text-amber-400">
                        ({form.description.trim().length}/50 caracteres)
                      </span>
                    )}
                  </Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Describe tu producto con detalles: características principales, materiales, beneficios, usos recomendados..."
                    rows={6}
                    className={`mt-1 resize-y ${form.description.trim().length >= 50 ? 'border-emerald-500' : ''}`}
                  />
                  <p className="text-xs text-dark-text-secondary mt-1">
                    Mínimo 50 caracteres. Incluye características técnicas y beneficios.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="stock" className="text-dark-text-primary">Stock disponible</Label>
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
                    <Label htmlFor="discount" className="text-dark-text-primary">Descuento (%)</Label>
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
                </div>
              </CardContent>
            </Card>

            {/* Sección Imágenes */}
            <Card id="image" className={`transition-all bg-dark-lighter border-dark-lighter ${focusedSection === 'image' ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : ''}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-dark-text-primary">
                  <Camera className="h-5 w-5" />
                  Imágenes del Producto
                  <span className="text-sm font-normal text-dark-text-secondary">(Obligatorio)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="image" className="flex items-center gap-2 text-dark-text-primary">
                    Imagen principal *
                    {form.image ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-400" />
                    )}
                  </Label>
                  <div className="mt-1">
                    <ImageManager
                      mode="single"
                      images={form.image ? [form.image] : []}
                      onImagesChange={(images) => setForm((prev: ProductForm) => ({ ...prev, image: images[0] || '' }))}
                      maxImages={1}
                    />
                  </div>
                  <p className="text-xs text-dark-text-secondary mt-2">
                    Recomendación: Mínimo 1200x1200px, fondo blanco, producto centrado.
                  </p>
                </div>

                <div>
                  <Label htmlFor="images" className="text-dark-text-primary">Imágenes adicionales (opcional)</Label>
                  <div className="mt-1">
                    <ImageManager
                      mode="reorder"
                      images={form.images}
                      onImagesChange={handleImagesReorder}
                      maxImages={10}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sección Dimensiones y Envío */}
            <Card id="dimensions" className={`transition-all bg-dark-lighter border-dark-lighter ${focusedSection === 'dimensions' ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : ''}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-dark-text-primary">
                  <Truck className="h-5 w-5" />
                  Dimensiones para Envío
                  <span className="text-sm font-normal text-dark-text-secondary">(Obligatorio para ME2)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="flex items-center gap-2 mb-3 text-dark-text-primary">
                    Dimensiones y peso *
                    {isME2Ready(form) ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-400" />
                    )}
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="height" className="text-dark-text-primary">Alto (cm)</Label>
                      <Input
                        id="height"
                        type="number"
                        step="0.1"
                        min="0"
                        value={form.height}
                        onChange={(e) => handleChange('height', e.target.value)}
                        placeholder="0.0"
                        className={form.height && parseFloat(form.height) > 0 ? 'border-emerald-500' : ''}
                      />
                    </div>

                    <div>
                      <Label htmlFor="width" className="text-dark-text-primary">Ancho (cm)</Label>
                      <Input
                        id="width"
                        type="number"
                        step="0.1"
                        min="0"
                        value={form.width}
                        onChange={(e) => handleChange('width', e.target.value)}
                        placeholder="0.0"
                        className={form.width && parseFloat(form.width) > 0 ? 'border-emerald-500' : ''}
                      />
                    </div>

                    <div>
                      <Label htmlFor="length" className="text-dark-text-primary">Largo (cm)</Label>
                      <Input
                        id="length"
                        type="number"
                        step="0.1"
                        min="0"
                        value={form.length}
                        onChange={(e) => handleChange('length', e.target.value)}
                        placeholder="0.0"
                        className={form.length && parseFloat(form.length) > 0 ? 'border-emerald-500' : ''}
                      />
                    </div>

                    <div>
                      <Label htmlFor="weight" className="text-dark-text-primary">Peso (kg)</Label>
                      <Input
                        id="weight"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.weight}
                        onChange={(e) => handleChange('weight', e.target.value)}
                        placeholder="0.00"
                        className={form.weight && parseFloat(form.weight) > 0 ? 'border-emerald-500' : ''}
                      />
                    </div>
                  </div>
                </div>

                {/* Estado ME2 */}
                <div className={`p-4 rounded-lg border ${isME2Ready(form) ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-amber-950/30 border-amber-800/50'}`}>
                  <div className="flex items-center gap-3">
                    {isME2Ready(form) ? (
                      <CheckCircle className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-400" />
                    )}
                    <div>
                      <p className={`font-medium ${isME2Ready(form) ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {isME2Ready(form) ? '✓ Compatible con Mercado Envíos 2' : '⚠ Incompleto para ME2'}
                      </p>
                      <p className="text-sm text-dark-text-secondary opacity-75">
                        {isME2Ready(form) 
                          ? 'Tu producto podrá usar los métodos de envío más rápidos'
                          : 'Completa todas las dimensiones para activar ME2'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Guías ME2 */}
                <div className="bg-dark-lightest rounded-lg p-4">
                  <ME2Guidelines 
                    dimensions={{
                      height: parseFloat(form.height) || undefined,
                      width: parseFloat(form.width) || undefined,
                      length: parseFloat(form.length) || undefined,
                      weight: parseFloat(form.weight) || undefined,
                    }}
                    showWarnings={true}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sección Categoría y Configuración ML */}
            <Card id="mlCategoryId" className={`transition-all bg-dark-lighter border-dark-lighter ${focusedSection === 'mlCategoryId' || focusedSection === 'mlCondition' || focusedSection === 'mlBuyingMode' || focusedSection === 'mlListingTypeId' ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : ''}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-dark-text-primary">
                  <Tag className="h-5 w-5" />
                  Configuración Mercado Libre
                  <span className="text-sm font-normal text-dark-text-secondary">(Obligatorio)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="mlCategoryId" className="flex items-center gap-2 text-dark-text-primary">
                    Categoría Mercado Libre *
                    {form.mlCategoryId ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-400" />
                    )}
                  </Label>
                  <MLCategorySelectSimple
                    value={form.mlCategoryId}
                    onValueChange={handleMlCategoryChange}
                    categories={categories}
                    placeholder="Seleccionar categoría ML"
                    disabled={mlCategories.length === 0}
                  />
                  {mlCategories.length === 0 && (
                    <div className="mt-3 p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg">
                      <p className="text-sm text-amber-300">
                        <AlertTriangle className="inline h-4 w-4 mr-1" />
                        No hay categorías oficiales configuradas. Ve a{" "}
                        <Link href="/admin/categories" className="underline font-medium">
                          Categorías
                        </Link>{" "}
                        y usa &quot;Actualizar desde Mercado Libre&quot;.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="mlCondition" className="flex items-center gap-2 text-dark-text-primary">
                      Condición *
                      {form.mlCondition ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-400" />
                      )}
                    </Label>
                    <Select value={form.mlCondition} onValueChange={(value) => handleChange('mlCondition', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Nuevo</SelectItem>
                        <SelectItem value="used">Usado</SelectItem>
                        <SelectItem value="not_specified">No especificado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="mlBuyingMode" className="flex items-center gap-2 text-dark-text-primary">
                      Modalidad *
                      {form.mlBuyingMode ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-400" />
                      )}
                    </Label>
                    <Select value={form.mlBuyingMode} onValueChange={(value) => handleChange('mlBuyingMode', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy_it_now">Comprar ahora</SelectItem>
                        <SelectItem value="auction">Subasta</SelectItem>
                        <SelectItem value="classified">Clasificado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="mlCurrencyId" className="text-dark-text-primary">Moneda *</Label>
                    <Select value={form.mlCurrencyId} onValueChange={(value) => handleChange('mlCurrencyId', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ARS">ARS - Pesos Argentinos</SelectItem>
                        <SelectItem value="USD">USD - Dólares</SelectItem>
                        <SelectItem value="UYU">UYU - Pesos Uruguayos</SelectItem>
                        <SelectItem value="CLP">CLP - Pesos Chilenos</SelectItem>
                        <SelectItem value="COP">COP - Pesos Colombianos</SelectItem>
                        <SelectItem value="MXN">MXN - Pesos Mexicanos</SelectItem>
                        <SelectItem value="PEN">PEN - Soles Peruanos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="mlListingTypeId" className="flex items-center gap-2 text-dark-text-primary">
                    Tipo de publicación *
                    {form.mlListingTypeId ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-400" />
                    )}
                  </Label>
                  <Select value={form.mlListingTypeId} onValueChange={(value) => handleChange('mlListingTypeId', value)}>
                    <SelectTrigger>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="warranty" className="flex items-center gap-2 text-dark-text-primary">
                      Garantía
                      {form.warranty ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <span className="text-xs text-dark-text-disabled">(opcional)</span>
                      )}
                    </Label>
                    <Input
                      id="warranty"
                      value={form.warranty}
                      onChange={(e) => handleChange('warranty', e.target.value)}
                      placeholder="Ej: 90 días, 1 año, sin garantía"
                    />
                  </div>

                  <div>
                    <Label htmlFor="videoId" className="text-dark-text-primary">ID de Video (opcional)</Label>
                    <Input
                      id="videoId"
                      value={form.videoId}
                      onChange={(e) => handleChange('videoId', e.target.value)}
                      placeholder="ID del video YouTube/Vimeo"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sección Atributos del Producto */}
            <Card id="attributes" className={`transition-all bg-dark-lighter border-dark-lighter ${focusedSection === 'attributes' ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : ''}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-dark-text-primary">
                  <Tag className="h-5 w-5" />
                  Atributos del Producto
                  {recommendedAttributes.filter(attr => attr.required).length > 0 && (
                    <span className="text-sm font-normal text-red-400">
                      ({recommendedAttributes.filter(attr => attr.required).length} requeridos)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <MLAttributesGuide
                  categoryId={form.mlCategoryId}
                  attributes={attributes}
                  onAttributesChange={setAttributes}
                  showValidationErrors={readinessScore < 100}
                />
                
                <div className="border-t border-dark-lighter pt-4">
                  <h4 className="text-sm font-medium text-dark-text-primary mb-3">Atributos Adicionales</h4>
                  <AttributeBuilder
                    attributes={attributes}
                    onChange={setAttributes}
                    recommendedAttributes={recommendedAttributes}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Opciones adicionales */}
            <Card id="warranty" className={`transition-all bg-dark-lighter border-dark-lighter ${focusedSection === 'warranty' ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : ''}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-dark-text-primary">
                  <Star className="h-5 w-5" />
                  Opciones Adicionales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3 p-4 rounded-lg border bg-dark-lightest">
                  <input
                    type="checkbox"
                    id="destacado"
                    checked={form.destacado}
                    onChange={(e) => handleChange('destacado', e.target.checked)}
                    className="h-4 w-4 rounded border-dark-lighter text-blue-500 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <Label htmlFor="destacado" className="text-sm font-medium cursor-pointer text-dark-text-primary">
                      Producto destacado
                    </Label>
                    <p className="text-xs text-dark-text-secondary mt-1">
                      Los productos destacados aparecen primero en la tienda
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botones de acción */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-dark-lighter bg-dark-lighter sticky bottom-0">
              <Link href="/admin/products">
                <Button type="button" variant="outline" className="w-full sm:w-auto">
                  Cancelar
                </Button>
              </Link>
              <Button 
                type="submit" 
                disabled={loading || readinessScore < 100} 
                className="w-full sm:w-auto"
                onClick={handleSubmit}
              >
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Creando...' : 'Crear Producto'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
