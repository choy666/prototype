"use client"

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { MLCategorySelectSimple } from '@/components/admin/MLCategorySelectSimple'
import { useToast } from '@/components/ui/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { ArrowLeft, FileText, Tag, Package, Eye, Truck, AlertCircle, CheckCircle, CheckSquare, Square, Camera } from 'lucide-react'
import { ImageManager } from '@/components/ui/ImageManager'
import { ME2Guidelines } from '@/components/admin/ME2Guidelines'
import { MLAttributesGuide } from '@/components/admin/MLAttributesGuide'
import { ProductVariantsNew } from '@/components/admin/ProductVariantsNew'
import { getValidations, calculateReadinessScore, getReadinessColor, getReadinessIcon, type ProductForm, type ValidationItem } from '@/lib/validations/product-validations'
import { validateProductForMercadoLibre } from '@/lib/actions/product-validation'
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
  mlCondition?: string
  mlBuyingMode?: string
  mlListingTypeId?: string
  mlCurrencyId?: string
  mlCategoryId?: string
  mlVideoId?: string
  height?: string
  width?: string
  length?: string
  mlItemId?: string | null
  shippingMode?: string | null
  me2Compatible?: boolean | null
}


type RecommendedAttributeConfig = {
  key: string
  label: string
  aliases: string[]
  required?: boolean
}

type ProductMe2Status = {
  loading: boolean
  error?: string
  isValid?: boolean
  canUseME2?: boolean
  missingAttributes: string[]
  warnings: string[]
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
    images: [],
    discount: '0',
    weight: '',
    stock: '0',
    destacado: false,
    attributes: [],
    mlCondition: 'new',
    mlBuyingMode: 'buy_it_now',
    mlListingTypeId: 'free',
    mlCurrencyId: 'ARS',
    mlCategoryId: '',
    warranty: '',
    videoId: '',
    height: '',
    width: '',
    length: '',
    mlItemId: '',
    shippingMode: 'me2',
    me2Compatible: false,
  })
  const [attributes, setAttributes] = useState<DynamicAttribute[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [recommendedAttributes, setRecommendedAttributes] = useState<RecommendedAttributeConfig[]>([])
  const [me2Status, setMe2Status] = useState<ProductMe2Status>({
    loading: true,
    missingAttributes: [],
    warnings: [],
  })

  // Función para verificar si faltan atributos requeridos
  const hasMissingRequiredAttributes = () => {
    const requiredAttributes = recommendedAttributes.filter(attr => attr.required)
    return requiredAttributes.length > 0 && 
      !requiredAttributes.every(req => 
        attributes.some(attr => 
          attr.name.toLowerCase() === req.key.toLowerCase() || 
          req.aliases.some((alias: string) => attr.name.toLowerCase() === alias.toLowerCase())
        )
      )
  }

  const [focusedSection, setFocusedSection] = useState<string>('')

  const id = params.id as string

  const mlCategories = categories.filter(
    (category) => category.mlCategoryId && category.isMlOfficial && category.isLeaf
  )

  const loadMe2Status = async (productId: number) => {
    try {
      setMe2Status(prev => ({
        ...prev,
        loading: true,
        error: undefined,
      }))

      const response = await fetch(`/api/admin/products/${productId}/me2-validation`)
      const data = await response.json().catch(() => null)

      if (!response.ok || !data) {
        throw new Error(data?.error || 'No se pudo validar compatibilidad ME2')
      }

      const result = data.result

      setMe2Status({
        loading: false,
        error: undefined,
        isValid: result?.isValid,
        canUseME2: result?.canUseME2,
        missingAttributes: result?.missingAttributes ?? [],
        warnings: result?.warnings ?? [],
      })
    } catch (error) {
      setMe2Status({
        loading: false,
        error: error instanceof Error ? error.message : 'No se pudo validar compatibilidad ME2',
        isValid: undefined,
        canUseME2: undefined,
        missingAttributes: [],
        warnings: [],
      })
    }
  }

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
          discount: String(product.discount || '0'),
          weight: product.weight || '',
          stock: product.stock.toString(),
          destacado: product.destacado,
          attributes: (product as unknown as { attributes?: DynamicAttribute[] }).attributes || [],
          mlCondition: product.mlCondition || 'new',
          mlBuyingMode: product.mlBuyingMode || 'buy_it_now',
          mlListingTypeId: product.mlListingTypeId || 'free',
          mlCurrencyId: product.mlCurrencyId || 'ARS',
          mlCategoryId: product.mlCategoryId || '',
          warranty: '',
          videoId: product.mlVideoId || '',
          height: (product.height as string | undefined) || '',
          width: (product.width as string | undefined) || '',
          length: (product.length as string | undefined) || '',
          variants: [], // Se cargarán desde ProductVariants
          mlItemId: (product.mlItemId as string | null) || '',
          shippingMode: (product.shippingMode as string | null) || 'me2',
          me2Compatible: (product.me2Compatible as boolean | null) ?? false,
        }

        setForm(initialForm)
        setAttributes((product as unknown as { attributes?: DynamicAttribute[] }).attributes || [])
        await loadMe2Status(product.id)
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
      if (!form.mlCategoryId) {
        throw new Error('Debes seleccionar una categoría de Mercado Libre')
      }

      // Validar readiness score básico
      if (calculateReadinessScore(form) < 100) {
        throw new Error('Completa todos los campos obligatorios antes de guardar')
      }

      // Validación completa para Mercado Libre
      const productForValidation = {
        id: parseInt(id),
        name: form.name,
        description: form.description,
        price: form.price,
        image: form.image,
        images: form.images,
        stock: String(form.stock || '0'),
        mlCategoryId: form.mlCategoryId,
        mlCondition: form.mlCondition,
        mlBuyingMode: form.mlBuyingMode,
        mlListingTypeId: form.mlListingTypeId,
        mlCurrencyId: form.mlCurrencyId,
        weight: form.weight,
        height: form.height,
        width: form.width,
        length: form.length,
        shippingMode: form.shippingMode || undefined,
        me2Compatible: form.me2Compatible ?? false,
        attributes: attributes,
        shippingAttributes: null, // Campo requerido por el tipo Product
        // Campos necesarios pero no usados en validación
        category: '',
        categoryId: 0,
        discount: String(form.discount || '0'),
        destacado: false,
        isActive: true,
        created_at: new Date(),
        updated_at: new Date(),
        mlItemId: form.mlItemId || undefined,
        mlSyncStatus: 'pending',
        mlLastSync: null,
        mlPermalink: null,
        mlThumbnail: null,
        mlVideoId: form.videoId || null,
        videoId: form.videoId || '',
        warranty: form.warranty || ''
      }

      const mlValidationResult = await validateProductForMercadoLibre(productForValidation)
      
      if (!mlValidationResult.success || !mlValidationResult.validation?.isValid) {
        const errorMessage = `El producto no cumple los requisitos de Mercado Libre:\n\n• ${mlValidationResult.validation?.errors?.join('\n• ') || 'Error de validación'}`
        throw new Error(errorMessage)
      }

      if (!mlValidationResult.validation?.isReadyForSync) {
        const warningMessage = `Advertencias para sincronización:\n\n• ${mlValidationResult.validation?.warnings?.join('\n• ') || ''}`
        toast({
          title: 'Advertencias de Mercado Libre',
          description: warningMessage,
          variant: 'default'
        })
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
        mlCondition: form.mlCondition,
        mlBuyingMode: form.mlBuyingMode,
        mlListingTypeId: form.mlListingTypeId,
        mlCurrencyId: form.mlCurrencyId,
        mlCategoryId: form.mlCategoryId,
        mlVideoId: form.videoId || undefined,
        height: form.height || undefined,
        width: form.width || undefined,
        length: form.length || undefined,
        mlItemId: form.mlItemId || undefined,
        shippingMode: form.shippingMode || undefined,
        me2Compatible: mlValidationResult.validation?.isReadyForSync || false,
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
        throw new Error(error.error || 'No se pudo actualizar el producto')
      }

      if (mlValidationResult.validation?.isReadyForSync) {
        toast({
          title: '✅ Producto actualizado y listo para sincronizar',
          description: 'El producto cumple todos los requisitos de Mercado Libre',
        })
      } else {
        toast({
          title: 'Producto actualizado',
          description: 'El producto se ha actualizado correctamente',
        })
      }
      
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
      }))
    } else {
      setForm((prev: ProductForm) => ({ ...prev, mlCategoryId: categoryId }))
    }
  }

  if (fetchLoading) {
    return (
      <div className="min-h-screen bg-dark dark:bg-dark">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-10 w-24" />
            <div>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Card className="bg-dark-lighter border-dark-lighter">
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
      </div>
    )
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
                <h1 className="text-xl font-semibold text-dark-text-primary">Editar Producto</h1>
                <p className="text-sm text-dark-text-secondary">Modifica la información del producto</p>
              </div>
            </div>
            
            {/* Indicator de progreso */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${getReadinessColor(calculateReadinessScore(form))}`}>
              {getReadinessIcon(calculateReadinessScore(form))}
              <div className="text-right">
                <div className="text-sm font-medium">{calculateReadinessScore(form)}% Completo</div>
                <div className="text-xs opacity-75">ML Ready</div>
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
                {getValidations(form, attributes, recommendedAttributes).map((validation: ValidationItem) => (
                  <div
                    key={validation.field}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer
                      ${validation.isValid ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-800/30' : 'bg-dark-lightest text-dark-text-secondary border border-dark-lighter'}
                      ${focusedSection === validation.field ? 'ring-2 ring-blue-500' : ''}
                    `}
                    onClick={() => setFocusedSection(validation.field)}
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

          {/* Contenido principal */}
          <div className="lg:col-span-3">
            <div className="flex flex-col gap-3 rounded-lg border bg-dark-lighter border-dark-lighter p-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium flex items-center gap-2 text-dark-text-primary">
                  <Truck className="h-4 w-4" />
                  Estado de compatibilidad para Mercado Envíos (ME2)
                </p>
                {me2Status.loading ? (
                  <p className="text-xs text-dark-text-secondary">Validando atributos ME2 del producto…</p>
                ) : me2Status.error ? (
                  <p className="text-xs text-red-400">
                    {me2Status.error}
                  </p>
                ) : (
                  <>
                    {me2Status.canUseME2 ? (
                      <div className="flex items-center gap-2">
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-950/30 text-emerald-300">
                          <CheckCircle className="h-3 w-3" />
                          Compatible ME2
                        </div>
                        <span className="text-xs text-dark-text-secondary">Sin fallback necesario</span>
                      </div>
                    ) : me2Status.isValid ? (
                      <div className="flex items-center gap-2">
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-950/30 text-amber-300">
                          <AlertCircle className="h-3 w-3" />
                          Parcialmente compatible
                        </div>
                        <span className="text-xs text-dark-text-secondary">Falta vincular publicación ML</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-950/30 text-red-300">
                          <AlertCircle className="h-3 w-3" />
                          No compatible ME2
                        </div>
                        <span className="text-xs text-dark-text-secondary">Faltan datos obligatorios</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const numericId = parseInt(id, 10)
                    if (!Number.isNaN(numericId)) {
                      void loadMe2Status(numericId)
                    }
                  }}
                  className="min-h-[32px]"
                >
                  Revalidar ME2
                </Button>
              </div>
            </div>

            <Tabs defaultValue="basic" className="w-full mt-6">
              <div className="overflow-x-auto pb-2">
                <TabsList className="grid w-full min-w-max grid-cols-3 bg-dark-lighter border-dark-lighter">
                  <TabsTrigger value="basic" className="flex items-center gap-2 transition-all duration-200 whitespace-nowrap data-[state=active]:bg-dark data-[state=active]:text-dark-text-primary">
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Información</span>
                  </TabsTrigger>
                  <TabsTrigger value="attributes" className="flex items-center gap-2 transition-all duration-200 whitespace-nowrap data-[state=active]:bg-dark data-[state=active]:text-dark-text-primary relative">
                    <Tag className="h-4 w-4" />
                    <span className="hidden sm:inline">Atributos</span>
                    {hasMissingRequiredAttributes() && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="variants" className="flex items-center gap-2 transition-all duration-200 whitespace-nowrap data-[state=active]:bg-dark data-[state=active]:text-dark-text-primary">
                    <Package className="h-4 w-4" />
                    <span className="hidden sm:inline">Variantes</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="basic" className="animate-in fade-in slide-in-from-right-2 duration-300">
                <Card className="transition-all duration-300 hover:shadow-lg bg-dark-lighter border-dark-lighter">
                  <CardHeader>
                    <CardTitle className="text-dark-text-primary">Información del Producto</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-8 pb-24">
{/* Sección Información Básica */}
                      <div className="space-y-6">
                        <div className="border-b border-dark-lighter pb-2">
                          <h3 className="text-lg font-medium flex items-center gap-2 text-dark-text-primary">
                            <FileText className="h-5 w-5" />
                            Información Básica
                          </h3>
                          <p className="text-sm text-dark-text-secondary mt-1">
                            Los datos principales del producto que se mostrarán en la tienda
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                          <div className="sm:col-span-2 lg:col-span-3">
                            <Label htmlFor="name" className="text-dark-text-primary">Nombre *</Label>
                            <Input
                              id="name"
                              value={form.name}
                              onChange={(e) => handleChange('name', e.target.value)}
                              placeholder="Nombre del producto"
                              required
                              style={{ touchAction: 'manipulation' }}
                            />
                          </div>

                          <div>
                            <Label htmlFor="price" className="text-dark-text-primary">Precio *</Label>
                            <Input
                              id="price"
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={form.price}
                              onChange={(e) => handleChange('price', e.target.value)}
                              placeholder="0.00"
                              required
                              style={{ touchAction: 'manipulation' }}
                            />
                          </div>

                          <div>
                            <Label htmlFor="stock" className="text-dark-text-primary">Stock</Label>
                            <Input
                              id="stock"
                              type="number"
                              min="0"
                              value={form.stock}
                              onChange={(e) => handleChange('stock', e.target.value)}
                              placeholder="0"
                              style={{ touchAction: 'manipulation' }}
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
                              style={{ touchAction: 'manipulation' }}
                            />
                          </div>

                          <div className="sm:col-span-2 lg:col-span-3">
                            <Label htmlFor="mlCategoryId" className="text-dark-text-primary">Categoría Mercado Libre *</Label>
                            <MLCategorySelectSimple
                              value={form.mlCategoryId}
                              onValueChange={handleMlCategoryChange}
                              categories={categories}
                              placeholder="Seleccionar categoría ML"
                              disabled={categoriesLoading || mlCategories.length === 0}
                            />
                            {mlCategories.length === 0 && (
                              <p className="mt-2 text-sm text-amber-400">
                                No hay categorías oficiales de Mercado Libre configuradas. Ve a la sección Categorías y usa el botón Actualizar desde Mercado Libre antes de editar productos.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sección Descripción */}
                      <div className="space-y-6">
                        <div className="border-b border-dark-lighter pb-2">
                          <h3 className="text-lg font-medium flex items-center gap-2 text-dark-text-primary">
                            <FileText className="h-5 w-5" />
                            Descripción del Producto
                          </h3>
                          <p className="text-sm text-dark-text-secondary mt-1">
                            Describe tu producto con detalles: características principales, materiales, beneficios, usos recomendados...
                          </p>
                        </div>
                        
                        <div>
                          <Label htmlFor="description" className="text-dark-text-primary">Descripción *</Label>
                          <textarea
                            id="description"
                            value={form.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder="Describe tu producto con detalles: características principales, materiales, beneficios, usos recomendados..."
                            rows={6}
                            className={`mt-1 resize-y block w-full rounded-md border border-dark-lighter bg-dark-lighter px-3 py-2 text-sm text-dark-text-primary placeholder:text-dark-text-disabled ${form.description.trim().length >= 50 ? 'border-emerald-500' : ''}`}
                          />
                          <p className="text-xs text-dark-text-secondary mt-1">
                            Mínimo 50 caracteres. Incluye características técnicas y beneficios.
                          </p>
                        </div>
                      </div>

{/* Sección Imágenes */}
                      <div className="space-y-6">
                        <div className="border-b border-dark-lighter pb-2">
                          <h3 className="text-lg font-medium flex items-center gap-2 text-dark-text-primary">
                            <Camera className="h-5 w-5" />
                            Imágenes del Producto
                          </h3>
                          <p className="text-sm text-dark-text-secondary mt-1">
                            Imágenes principal y adicionales para mostrar en la tienda
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div>
                            <Label htmlFor="image" className="text-dark-text-primary">Imagen Principal</Label>
                            <Input
                              id="image"
                              type="url"
                              value={form.image || ''}
                              onChange={(e) => handleChange('image', e.target.value)}
                              placeholder="https://ejemplo.com/imagen.jpg"
                              style={{ touchAction: 'manipulation' }}
                            />
                            {form.image && (
                              <div className="flex items-center gap-3 p-3 border rounded-lg bg-dark-lightest border-dark-lighter mt-2">
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-dark-lighter">
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
                                  <p className="text-sm font-medium text-dark-text-primary">Imagen Principal</p>
                                  <p className="text-xs text-dark-text-secondary truncate max-w-xs">{form.image}</p>
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

                        <div>
                          <Label htmlFor="images" className="text-dark-text-primary">Imágenes Adicionales</Label>
                          <ImageManager
                            mode="reorder"
                            images={form.images}
                            onImagesChange={handleImagesReorder}
                            maxImages={10}
                          />
                        </div>
                      </div>

                      {/* Sección Dimensiones y Envío */}
                      <div className="space-y-6">
                        <div className="border-b border-dark-lighter pb-2">
                          <h3 className="text-lg font-medium flex items-center gap-2 text-dark-text-primary">
                            <Truck className="h-5 w-5" />
                            Dimensiones y Configuración de Envío
                          </h3>
                          <p className="text-sm text-dark-text-secondary mt-1">
                            Datos necesarios para el cálculo de envíos y logística
                          </p>
                        </div>
                        
                        <div className="space-y-4">
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
                                style={{ touchAction: 'manipulation' }}
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
                                style={{ touchAction: 'manipulation' }}
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
                                style={{ touchAction: 'manipulation' }}
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
                                style={{ touchAction: 'manipulation' }}
                              />
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
                        </div>
                      </div>

                      {/* Sección Configuración Mercado Libre */}
                      <div className="space-y-6">
                        <div className="border-b border-dark-lighter pb-2">
                          <h3 className="text-lg font-medium flex items-center gap-2 text-dark-text-primary">
                            <Tag className="h-5 w-5" />
                            Configuración Mercado Libre
                          </h3>
                          <p className="text-sm text-dark-text-secondary mt-1">
                            Opciones específicas para la integración con Mercado Libre
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                          <div>
                            <Label htmlFor="mlItemId" className="text-dark-text-primary">ML Item ID (opcional)</Label>
                            <Input
                              id="mlItemId"
                              value={form.mlItemId}
                              onChange={(e) => handleChange('mlItemId', e.target.value)}
                              placeholder="MLA123456789"
                              style={{ touchAction: 'manipulation' }}
                            />
                            <p className="mt-1 text-xs text-dark-text-secondary">
                              Se completa automáticamente al sincronizar con Mercado Libre, pero puedes ajustarlo si ya existe una publicación.
                            </p>
                          </div>

                          <div>
                            <Label htmlFor="shippingMode" className="text-dark-text-primary">Modo de envío ML</Label>
                            <select
                              id="shippingMode"
                              value={form.shippingMode}
                              onChange={(e) => handleChange('shippingMode', e.target.value)}
                              className="mt-1 block w-full rounded-md border border-dark-lighter bg-dark-lighter px-3 py-2 text-sm text-dark-text-primary"
                            >
                              <option value="me2">Mercado Envíos (ME2)</option>
                              <option value="custom">Envío personalizado / local</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Sección Opciones Adicionales */}
                      <div className="space-y-6">
                        <div className="border-b border-dark-lighter pb-2">
                          <h3 className="text-lg font-medium text-dark-text-primary">Opciones Adicionales</h3>
                          <p className="text-sm text-dark-text-secondary mt-1">
                            Configuraciones extras para el producto
                          </p>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex items-center space-x-3 p-4 rounded-lg border bg-dark-lightest border-dark-lighter">
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
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-dark-lighter bg-dark-lighter sticky bottom-0">
                        <Link href="/admin/products">
                          <Button type="button" variant="outline" className="w-full sm:w-auto">
                            Cancelar
                          </Button>
                        </Link>
                        <Button 
                          type="submit" 
                          disabled={loading} 
                          className="w-full sm:w-auto"
                        >
                          {loading ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="attributes" className="animate-in fade-in slide-in-from-right-2 duration-300">
                <Card className="transition-all duration-300 hover:shadow-lg bg-dark-lighter border-dark-lighter">
                  <CardHeader>
                    <CardTitle className="text-dark-text-primary">Atributos del Producto</CardTitle>
                    <p className="text-sm text-dark-text-secondary">
                      Define atributos adicionales como talla, color, material, etc. Estos atributos pueden ser usados
                      para mapear variaciones en Mercado Libre.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <MLAttributesGuide
                      categoryId={form.mlCategoryId}
                      attributes={attributes}
                      onAttributesChange={setAttributes}
                      showValidationErrors={hasMissingRequiredAttributes()}
                    />
                    
                    {/* Botón para guardar atributos */}
                    <div className="mt-6 flex justify-end">
                      <Button
                        type="button"
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/admin/products/${id}/attributes`, {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({
                                attributes: attributes.length > 0 ? attributes : {}
                              })
                            })

                            if (!response.ok) {
                              const error = await response.json()
                              throw new Error(error.error || 'No se pudieron guardar los atributos')
                            }

                            // Actualizar el estado local con los atributos guardados
                            setForm(prev => ({ ...prev, attributes: attributes }))

                            toast({
                              title: 'Atributos guardados',
                              description: 'Los atributos se han guardado correctamente'
                            })
                          } catch (error) {
                            toast({
                              title: 'Error',
                              description: error instanceof Error ? error.message : 'No se pudieron guardar los atributos',
                              variant: 'destructive'
                            })
                          }
                        }}
                        className="min-h-[32px]"
                      >
                        Guardar Atributos
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="variants" className="animate-in fade-in slide-in-from-right-2 duration-300">
                <Card className="transition-all duration-300 hover:shadow-lg bg-dark-lighter border-dark-lighter">
                  <CardHeader>
                    <CardTitle className="text-dark-text-primary">Variantes del Producto</CardTitle>
                    <p className="text-sm text-dark-text-secondary">
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

            {/* Preview Section - Comentado temporalmente */}
            {/* {showPreview && (
              <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all duration-300 hover:shadow-lg bg-dark-lighter border-dark-lighter">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-dark-text-primary">
                    <Eye className="h-5 w-5" />
                    Vista Previa del Producto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-dark-text-primary">{form.name || 'Nombre del producto'}</h3>
                      <p className="text-dark-text-secondary">{form.description || 'Descripción del producto'}</p>
                      <p className="text-2xl font-bold text-emerald-400">
                        ${form.price ? parseFloat(form.price).toFixed(2) : '0.00'}
                      </p>
                    </div>

                    {attributes.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2 text-dark-text-primary">Caracteristicas:</h4>
                        <div className="flex flex-wrap gap-2">
                          {attributes.map((attr, index) => (
                            <div key={index} className="text-sm">
                              <span className="font-medium text-dark-text-primary">{attr.name}:</span>
                              <span className="ml-1 px-2 py-1 bg-blue-950/30 text-blue-300 rounded">
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
            )} */}
          </div>
        </div>
      </div>
    </div>
  )
}
