'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { Plus, Edit, Trash2, Package } from 'lucide-react'
import Image from 'next/image'

interface ProductVariant {
  id: number
  sku?: string
  attributes: Record<string, string>
  price?: string
  stock: number
  image?: string
  isActive: boolean
}

interface ProductAttribute {
  id: number
  name: string
  values: string[]
}

interface ProductVariantsProps {
  productId: number
}

export function ProductVariants({ productId }: ProductVariantsProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [attributes, setAttributes] = useState<ProductAttribute[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; variantId: number | null }>({
    isOpen: false,
    variantId: null
  })
  const [formData, setFormData] = useState({
    sku: '',
    attributes: {} as Record<string, string>,
    price: '',
    stock: 0,
    image: ''
  })
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [variantsRes, attributesRes] = await Promise.all([
        fetch(`/api/admin/products/${productId}/variants`),
        fetch('/api/admin/product-attributes')
      ])

      if (variantsRes.ok) {
        const variantsData = await variantsRes.json()
        setVariants(variantsData)
      }

      if (attributesRes.ok) {
        const attributesData = await attributesRes.json()
        setAttributes(attributesData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las variantes y atributos',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [productId, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const method = editingVariant ? 'PUT' : 'POST'
      const url = editingVariant
        ? `/api/admin/products/${productId}/variants`
        : `/api/admin/products/${productId}/variants`

      const body = editingVariant
        ? { variantId: editingVariant.id, ...formData }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar la variante')
      }

      toast({
        title: 'Éxito',
        description: `Variante ${editingVariant ? 'actualizada' : 'creada'} correctamente`
      })

      fetchData()
      resetForm()
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la variante',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteDialog.variantId) return

    try {
      const response = await fetch(`/api/admin/products/${productId}/variants?variantId=${deleteDialog.variantId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Error al eliminar la variante')
      }

      toast({
        title: 'Éxito',
        description: 'Variante eliminada correctamente'
      })

      fetchData()
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la variante',
        variant: 'destructive'
      })
    } finally {
      setDeleteDialog({ isOpen: false, variantId: null })
    }
  }

  const resetForm = () => {
    setFormData({
      sku: '',
      attributes: {},
      price: '',
      stock: 0,
      image: ''
    })
    setEditingVariant(null)
    setShowForm(false)
  }

  const startEdit = (variant: ProductVariant) => {
    setFormData({
      sku: variant.sku || '',
      attributes: variant.attributes,
      price: variant.price || '',
      stock: variant.stock,
      image: variant.image || ''
    })
    setEditingVariant(variant)
    setShowForm(true)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Variantes del Producto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Variantes del Producto</CardTitle>
          <Button onClick={() => setShowForm(!showForm)} className="min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? 'Cancelar' : 'Nueva Variante'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Formulario */}
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
            <h3 className="font-semibold">
              {editingVariant ? 'Editar Variante' : 'Nueva Variante'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">SKU (opcional)</label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  placeholder="SKU-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Precio (opcional)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Stock</label>
                <Input
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Imagen (opcional)</label>
                <Input
                  type="url"
                  value={formData.image}
                  onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                  placeholder="https://ejemplo.com/imagen.jpg"
                />
              </div>
            </div>

            {/* Atributos */}
            <div>
              <label className="block text-sm font-medium mb-2">Atributos</label>
              <div className="space-y-2">
                {attributes.map((attribute) => (
                  <div key={attribute.id} className="flex items-center gap-2">
                    <span className="text-sm font-medium min-w-[100px]">{attribute.name}:</span>
                    <select
                      value={formData.attributes[attribute.name] || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        attributes: {
                          ...prev.attributes,
                          [attribute.name]: e.target.value
                        }
                      }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white min-h-[44px]"
                    >
                      <option value="">Seleccionar {attribute.name.toLowerCase()}</option>
                      {attribute.values.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="min-h-[44px]">
                {editingVariant ? 'Actualizar' : 'Crear'} Variante
              </Button>
              <Button type="button" variant="outline" onClick={resetForm} className="min-h-[44px]">
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {/* Lista de variantes */}
        <div className="space-y-4">
          {variants.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="mx-auto h-12 w-12 mb-4" />
              <p>No hay variantes configuradas para este producto.</p>
            </div>
          ) : (
            variants.map((variant) => (
              <div key={variant.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    {variant.image && (
                      <Image
                        src={variant.image}
                        alt="Variante"
                        width={48}
                        height={48}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    <div>
                      <p className="font-medium">
                        {Object.entries(variant.attributes).map(([key, value]) => `${key}: ${value}`).join(', ')}
                      </p>
                      {variant.sku && <p className="text-sm text-gray-600">SKU: {variant.sku}</p>}
                      <p className="text-sm text-gray-600">
                        Stock: {variant.stock}
                        {variant.price && ` | Precio: $${parseFloat(variant.price).toFixed(2)}`}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(variant)}
                    className="min-h-[36px]"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialog({ isOpen: true, variantId: variant.id })}
                    className="min-h-[36px]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        title="Eliminar Variante"
        description="¿Estás seguro de que quieres eliminar esta variante? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, variantId: null })}
      />
    </Card>
  )
}
