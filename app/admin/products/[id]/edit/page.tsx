'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
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
import { Collapsible } from '@/components/ui/Collapsible'
import { Tooltip } from '@/components/ui/Tooltip'
import { Progress } from '@/components/ui/Progress'
import { ArrowLeft, Save, FileText, Tag, Package, Eye, Settings, Download, Upload, RotateCcw, RotateCw, HelpCircle, CheckCircle } from 'lucide-react'
import { ImageReorder } from '@/components/ui/ImageReorder'
import { ProductVariants } from '@/components/admin/ProductVariants'
import { AttributeBuilder } from '@/components/admin/AttributeBuilder'
import type { Category } from '@/lib/schema'
import type { DynamicAttribute } from '@/components/admin/AttributeBuilder'

interface VariantForm {
  attributes: Record<string, string>
  stock: number
  price: string
  image: string
}

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
  variants: VariantForm[]
}

interface ProductConfig {
  id: string
  name: string
  attributes: DynamicAttribute[]
  variants: VariantForm[]
  createdAt: string
}

interface UndoRedoState {
  past: ProductForm[]
  present: ProductForm
  future: ProductForm[]
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
    categoryId: '',
    discount: '0',
    weight: '',
    stock: '0',
    destacado: false,
    dynamicAttributes: [],
    variants: []
  })
  const [attributes, setAttributes] = useState<DynamicAttribute[]>([])
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [undoRedo, setUndoRedo] = useState<UndoRedoState>({
    past: [],
    present: form,
    future: []
  })
  const [templates, setTemplates] = useState<ProductConfig[]>([])
  const [showPreview, setShowPreview] = useState(false)

  const id = params.id as string

  // Auto-save functionality
  const autoSave = useCallback(async (currentForm: ProductForm) => {
    if (!autoSaveEnabled || isSaving) return

    setIsSaving(true)
    try {
      const productData = {
        name: currentForm.name,
        description: currentForm.description || undefined,
        price: currentForm.price,
        image: currentForm.image || undefined,
        images: currentForm.images,
        categoryId: parseInt(currentForm.categoryId),
        discount: parseInt(currentForm.discount),
        weight: currentForm.weight || undefined,
        stock: parseInt(currentForm.stock) || 0,
        destacado: currentForm.destacado,
        attributes: attributes.length > 0 ? attributes : undefined
      }

      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      })

      if (response.ok) {
        setLastSaved(new Date())
      }
    } catch (error) {
      console.error('Auto-save failed:', error)
    } finally {
      setIsSaving(false)
    }
  }, [autoSaveEnabled, isSaving, attributes, id])

  // Undo/Redo functionality
  const saveToHistory = useCallback((newForm: ProductForm) => {
    setUndoRedo(prev => ({
      past: [...prev.past, prev.present],
      present: newForm,
      future: []
    }))
  }, [])

  const undo = useCallback(() => {
    setUndoRedo(prev => {
      if (prev.past.length === 0) return prev
      const newPresent = prev.past[prev.past.length - 1]
      const newPast = prev.past.slice(0, -1)
      return {
        past: newPast,
        present: newPresent,
        future: [prev.present, ...prev.future]
      }
    })
  }, [])

  const redo = useCallback(() => {
    setUndoRedo(prev => {
      if (prev.future.length === 0) return prev
      const newPresent = prev.future[0]
      const newFuture = prev.future.slice(1)
      return {
        past: [...prev.past, prev.present],
        present: newPresent,
        future: newFuture
      }
    })
  }, [])

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
        setUndoRedo({ past: [], present: initialForm, future: [] })
        setAttributes((product as unknown as { attributes?: DynamicAttribute[] }).attributes || [])
        setLastSaved(new Date())
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

    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/admin/product-templates')
        if (response.ok) {
          const templatesData = await response.json()
          setTemplates(templatesData)
        }
      } catch (error) {
        console.error('Error fetching templates:', error)
      }
    }

    fetchCategories()
    fetchTemplates()
    if (id) fetchProduct()
  }, [id, router, toast])

  // Generate combinations when dynamic attributes change
  useEffect(() => {
    const generateCombinations = (dynamicAttrs: DynamicAttribute[]) => {
      if (dynamicAttrs.length === 0) return []

      const combinations = dynamicAttrs.reduce((acc, attr) => {
        if (acc.length === 0) {
          return attr.values.map((value: string) => ({ [attr.name]: value }))
        }
        return acc.flatMap(comb =>
          attr.values.map((value: string) => ({ ...comb, [attr.name]: value }))
        )
      }, [] as Record<string, string>[])

      return combinations.map(attrs => ({
        attributes: attrs,
        stock: 0,
        price: '',
        image: ''
      }))
    }

    const combinations = generateCombinations(attributes)
    setForm(prev => {
      const newForm = { ...prev, variants: combinations }
      saveToHistory(newForm)
      return newForm
    })
  }, [attributes, saveToHistory])

  // Auto-save effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      autoSave(form)
    }, 2000) // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(timeoutId)
  }, [form, autoSave])

  // Update form when undo/redo changes
  useEffect(() => {
    setForm(undoRedo.present)
  }, [undoRedo.present])

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
    setForm(prev => {
      const newForm = { ...prev, [field]: value }
      saveToHistory(newForm)
      return newForm
    })
  }

  const handleImagesReorder = (images: string[]) => {
    setForm(prev => {
      const newForm = { ...prev, images }
      saveToHistory(newForm)
      return newForm
    })
  }

  const handleImageRemove = (index: number) => {
    setForm(prev => {
      const newForm = {
        ...prev,
        images: prev.images.filter((_, i) => i !== index)
      }
      saveToHistory(newForm)
      return newForm
    })
  }

  const handleImageAdd = (imageUrl: string) => {
    setForm(prev => {
      const newForm = {
        ...prev,
        images: [...prev.images, imageUrl]
      }
      saveToHistory(newForm)
      return newForm
    })
  }

  // Export/Import functionality
  const exportConfig = () => {
    const config: ProductConfig = {
      id: `config-${Date.now()}`,
      name: form.name || 'Configuración sin nombre',
      attributes: attributes,
      variants: form.variants,
      createdAt: new Date().toISOString()
    }

    const dataStr = JSON.stringify(config, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)

    const exportFileDefaultName = `product-config-${form.name.replace(/\s+/g, '-').toLowerCase()}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const config: ProductConfig = JSON.parse(e.target?.result as string)
        setAttributes(config.attributes)
        setForm(prev => {
          const newForm = {
            ...prev,
            variants: config.variants
          }
          saveToHistory(newForm)
          return newForm
        })
        toast({
          title: 'Éxito',
          description: 'Configuración importada correctamente'
        })
      } catch {
        toast({
          title: 'Error',
          description: 'Archivo de configuración inválido',
          variant: 'destructive'
        })
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const applyTemplate = (template: ProductConfig) => {
    setAttributes(template.attributes)
    setForm(prev => {
      const newForm = {
        ...prev,
        variants: template.variants
      }
      saveToHistory(newForm)
      return newForm
    })
    toast({
      title: 'Éxito',
      description: `Plantilla "${template.name}" aplicada`
    })
  }

  // Calculate completion progress
  const calculateProgress = () => {
    let completed = 0
    let total = 6 // name, price, category, description, attributes, variants

    if (form.name.trim()) completed++
    if (form.price && parseFloat(form.price) > 0) completed++
    if (form.categoryId) completed++
    if (form.description.trim()) completed++
    if (attributes.length > 0) completed++
    if (form.variants.length > 0) completed++

    return (completed / total) * 100
  }

  const handleVariantChange = (index: number, field: keyof VariantForm, value: string | number) => {
    setForm(prev => ({
      ...prev,
      variants: prev.variants.map((variant, i) =>
        i === index ? { ...variant, [field]: value } : variant
      )
    }))
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
          {/* Auto-save indicator */}
          {lastSaved && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Guardado {lastSaved.toLocaleTimeString()}
                </>
              )}
            </div>
          )}

          {/* Undo/Redo */}
          <Tooltip content="Deshacer">
            <Button
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={undoRedo.past.length === 0}
              className="min-h-[36px]"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Rehacer">
            <Button
              variant="outline"
              size="sm"
              onClick={redo}
              disabled={undoRedo.future.length === 0}
              className="min-h-[36px]"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </Tooltip>

          {/* Export/Import */}
          <Tooltip content="Exportar configuración">
            <Button
              variant="outline"
              size="sm"
              onClick={exportConfig}
              className="min-h-[36px]"
            >
              <Download className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Importar configuración">
            <label className="cursor-pointer">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="min-h-[36px]"
              >
                <span>
                  <Upload className="h-4 w-4" />
                </span>
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={importConfig}
                className="hidden"
              />
            </label>
          </Tooltip>

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

      {/* Progress bar */}
      <Card className="transition-all duration-300 hover:shadow-md">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progreso de completitud</span>
            <span className="text-sm text-muted-foreground animate-in fade-in duration-300">{Math.round(calculateProgress())}%</span>
          </div>
          <Progress value={calculateProgress()} className="w-full transition-all duration-500" />
        </CardContent>
      </Card>

      {/* Main content with tabs */}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic" className="flex items-center gap-2 transition-all duration-200 hover:scale-105">
            <FileText className="h-4 w-4" />
            Información Básica
          </TabsTrigger>
          <TabsTrigger value="attributes" className="flex items-center gap-2 transition-all duration-200 hover:scale-105">
            <Tag className="h-4 w-4" />
            Atributos
          </TabsTrigger>
          <TabsTrigger value="variants" className="flex items-center gap-2 transition-all duration-200 hover:scale-105">
            <Package className="h-4 w-4" />
            Variantes
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2 transition-all duration-200 hover:scale-105">
            <Settings className="h-4 w-4" />
            Plantillas
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
                      onChange={(e) => handleChange('stock', e.target.value)}
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
                    attributes={attributes}
                    onChange={setAttributes}
                  />
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
                <Collapsible title="Vista Rápida de Variantes" defaultOpen={true}>
                  {form.variants.length > 0 ? (
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
                  ) : (
                    <p className="text-muted-foreground">No hay variantes configuradas. Agrega atributos primero.</p>
                  )}
                </Collapsible>

                <div className="mt-6">
                  <ProductVariants productId={parseInt(id)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="animate-in fade-in slide-in-from-right-2 duration-300">
            <Card className="transition-all duration-300 hover:shadow-lg">
              <CardHeader>
                <CardTitle>Plantillas y Configuraciones</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Aplica plantillas predefinidas o guarda/exporta configuraciones
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <Collapsible title="Plantillas Disponibles" icon={<Settings className="h-4 w-4" />}>
                  {templates.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {templates.map((template) => (
                        <div key={template.id} className="p-4 border rounded-lg">
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm text-muted-foreground mb-2">
                            {template.attributes.length} atributos, {template.variants.length} variantes
                          </p>
                          <Button
                            onClick={() => applyTemplate(template)}
                            size="sm"
                            className="w-full"
                          >
                            Aplicar Plantilla
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No hay plantillas disponibles.</p>
                  )}
                </Collapsible>

                <Collapsible title="Acciones de Configuración" icon={<Download className="h-4 w-4" />}>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Exportar Configuración</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Descarga la configuración actual de atributos y variantes como archivo JSON
                      </p>
                      <Button onClick={exportConfig} variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Exportar Configuración
                      </Button>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Importar Configuración</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Carga una configuración previamente exportada
                      </p>
                      <label className="cursor-pointer">
                        <Button variant="outline" asChild>
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            Importar Configuración
                          </span>
                        </Button>
                        <input
                          type="file"
                          accept=".json"
                          onChange={importConfig}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </Collapsible>
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
                    <h4 className="font-medium mb-2">Atributos Disponibles:</h4>
                    <div className="flex flex-wrap gap-2">
                      {attributes.map((attr, index) => (
                        <div key={index} className="text-sm">
                          <span className="font-medium">{attr.name}:</span>
                          {attr.values.map((value, vIndex) => (
                            <span key={vIndex} className="ml-1 px-2 py-1 bg-blue-100 text-blue-800 rounded">
                              {value}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {form.variants.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Variantes ({form.variants.length}):</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {form.variants.slice(0, 6).map((variant, index) => (
                        <div key={index} className="p-2 border rounded text-sm">
                          {Object.entries(variant.attributes).map(([key, value]) => `${key}: ${value}`).join(', ')}
                          {variant.price && ` - $${variant.price}`}
                        </div>
                      ))}
                      {form.variants.length > 6 && (
                        <div className="p-2 border rounded text-sm text-muted-foreground">
                          ... y {form.variants.length - 6} más
                        </div>
                      )}
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
}
