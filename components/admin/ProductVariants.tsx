'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { Plus, Edit, Trash2, Package, X, AlertTriangle, CheckCircle, EyeOff, Check } from 'lucide-react'
import { ImageReorder } from '@/components/ui/ImageReorder'

interface ProductVariant {
  id: number
  attributes: Record<string, string>
  price?: string
  stock: number
  images?: string[]
  isActive: boolean
}

interface ProductVariantsProps {
  productId: number
}

export function ProductVariants({ productId }: ProductVariantsProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; variantId: number | null }>({
    isOpen: false,
    variantId: null
  })
  const [formData, setFormData] = useState({
    attributes: {} as Record<string, string>,
    price: '',
    stock: 0,
    images: [] as string[]
  })

  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedVariants, setSelectedVariants] = useState<number[]>([])
  const [inlineEditing, setInlineEditing] = useState<{ [key: number]: { field: string; value: string | number } }>({})
  const [inlineLoading, setInlineLoading] = useState<{ [key: number]: boolean }>({})
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const variantsRes = await fetch(`/api/admin/products/${productId}/variants`)

      if (variantsRes.ok) {
        const variantsData = await variantsRes.json()
        setVariants(variantsData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las variantes',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [productId, toast])

  // Filtrar variantes basado en estado
  const filteredVariants = variants.filter(variant => {
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && variant.isActive) ||
      (filterStatus === 'inactive' && !variant.isActive)

    return matchesStatus
  })

  // Funciones para edición en línea
  const startInlineEdit = (variantId: number, field: string, currentValue: string | number) => {
    setInlineEditing(prev => ({
      ...prev,
      [variantId]: { field, value: currentValue }
    }))
  }



  const saveInlineEdit = async (variantId: number) => {
    const editData = inlineEditing[variantId]
    if (!editData) return

    setInlineLoading(prev => ({ ...prev, [variantId]: true }))

    try {
      const response = await fetch(`/api/admin/products/${productId}/variants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId,
          [editData.field]: editData.value
        })
      })

      if (!response.ok) throw new Error('Error al actualizar')

      toast({
        title: 'Éxito',
        description: 'Variante actualizada correctamente'
      })

      fetchData()
      setInlineEditing(prev => {
        const newState = { ...prev }
        delete newState[variantId]
        return newState
      })
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la variante',
        variant: 'destructive'
      })
    } finally {
      setInlineLoading(prev => ({ ...prev, [variantId]: false }))
    }
  }

  const cancelInlineEdit = (variantId: number) => {
    setInlineEditing(prev => {
      const newState = { ...prev }
      delete newState[variantId]
      return newState
    })
  }

  const updateInlineValue = (variantId: number, value: string | number) => {
    setInlineEditing(prev => ({
      ...prev,
      [variantId]: { ...prev[variantId], value }
    }))
  }

  // Funciones para acciones masivas
  const toggleVariantSelection = (variantId: number) => {
    setSelectedVariants(prev =>
      prev.includes(variantId)
        ? prev.filter(id => id !== variantId)
        : [...prev, variantId]
    )
  }

  const selectAllVariants = () => {
    setSelectedVariants(filteredVariants.map(v => v.id))
  }

  const clearSelection = () => {
    setSelectedVariants([])
  }

  const bulkActivate = async () => {
    try {
      await Promise.all(selectedVariants.map(variantId =>
        fetch(`/api/admin/products/${productId}/variants`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantId, isActive: true })
        })
      ))

      toast({
        title: 'Éxito',
        description: `${selectedVariants.length} variantes activadas`
      })

      fetchData()
      clearSelection()
    } catch {
      toast({
        title: 'Error',
        description: 'Error al activar variantes',
        variant: 'destructive'
      })
    }
  }

  const bulkDeactivate = async () => {
    try {
      await Promise.all(selectedVariants.map(variantId =>
        fetch(`/api/admin/products/${productId}/variants`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantId, isActive: false })
        })
      ))

      toast({
        title: 'Éxito',
        description: `${selectedVariants.length} variantes desactivadas`
      })

      fetchData()
      clearSelection()
    } catch {
      toast({
        title: 'Error',
        description: 'Error al desactivar variantes',
        variant: 'destructive'
      })
    }
  }

  const bulkDelete = async () => {
    try {
      await Promise.all(selectedVariants.map(variantId =>
        fetch(`/api/admin/products/${productId}/variants?variantId=${variantId}`, {
          method: 'DELETE'
        })
      ))

      toast({
        title: 'Éxito',
        description: `${selectedVariants.length} variantes eliminadas`
      })

      fetchData()
      clearSelection()
    } catch {
      toast({
        title: 'Error',
        description: 'Error al eliminar variantes',
        variant: 'destructive'
      })
    }
  }

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
      attributes: {},
      price: '',
      stock: 0,
      images: []
    })
    setEditingVariant(null)
    setShowForm(false)
  }

  const startEdit = (variant: ProductVariant) => {
    setFormData({
      attributes: variant.attributes,
      price: variant.price || '',
      stock: variant.stock,
      images: variant.images || []
    })
    setEditingVariant(variant)
    setShowForm(true)
  }

  const toggleVariantStatus = async (variantId: number, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/products/${productId}/variants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId,
          isActive: !currentStatus
        })
      })

      if (!response.ok) throw new Error('Error al cambiar estado')

      toast({
        title: 'Éxito',
        description: `Variante ${!currentStatus ? 'activada' : 'desactivada'} correctamente`
      })

      fetchData()
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo cambiar el estado de la variante',
        variant: 'destructive'
      })
    }
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
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Variantes del Producto
            <span className="text-sm font-normal text-gray-500">({filteredVariants.length})</span>
          </CardTitle>
          <Button onClick={() => setShowForm(!showForm)} className="min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? 'Cancelar' : 'Nueva Variante'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filtros */}
        <div className="flex gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('all')}
          >
            Todas
          </Button>
          <Button
            variant={filterStatus === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('active')}
          >
            Activas
          </Button>
          <Button
            variant={filterStatus === 'inactive' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('inactive')}
          >
            Inactivas
          </Button>
        </div>

        {/* Acciones masivas */}
        {selectedVariants.length > 0 && (
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <span className="text-sm font-medium">
              {selectedVariants.length} variante{selectedVariants.length !== 1 ? 's' : ''} seleccionada{selectedVariants.length !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={bulkActivate}
                className="min-h-[36px]"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Activar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={bulkDeactivate}
                className="min-h-[36px]"
              >
                <EyeOff className="h-3 w-3 mr-1" />
                Desactivar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialog({ isOpen: true, variantId: null })}
                className="min-h-[36px]"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Eliminar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="min-h-[36px]"
              >
                <X className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            </div>
          </div>
        )}

        {/* Formulario */}
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4 p-6 border rounded-lg bg-gray-50 dark:bg-gray-800">
            <h3 className="font-semibold text-lg">
              {editingVariant ? 'Editar Variante' : 'Nueva Variante'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Imágenes (opcional)</label>
                <ImageReorder
                  images={formData.images}
                  onReorder={(images) => setFormData(prev => ({ ...prev, images }))}
                  onRemove={(index) => setFormData(prev => ({
                    ...prev,
                    images: prev.images.filter((_, i) => i !== index)
                  }))}
                  onAdd={(imageUrl) => setFormData(prev => ({
                    ...prev,
                    images: [...prev.images, imageUrl]
                  }))}
                  maxImages={10}
                />
              </div>
            </div>

            {/* Atributos Dinámicos */}
            <div>
              <label className="block text-sm font-medium mb-2">Atributos</label>
              <div className="space-y-2">
                {Object.keys(formData.attributes).map((attrName) => (
                  <div key={attrName} className="flex items-center gap-2">
                    <span className="text-sm font-medium min-w-[100px]">{attrName}:</span>
                    <Input
                      value={formData.attributes[attrName] || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        attributes: {
                          ...prev.attributes,
                          [attrName]: e.target.value
                        }
                      }))}
                      placeholder={`Valor para ${attrName}`}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData(prev => {
                        const newAttributes = { ...prev.attributes }
                        delete newAttributes[attrName]
                        return { ...prev, attributes: newAttributes }
                      })}
                      className="min-h-[36px]"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const attrName = prompt('Nombre del atributo:')
                    if (attrName && !formData.attributes[attrName]) {
                      setFormData(prev => ({
                        ...prev,
                        attributes: {
                          ...prev.attributes,
                          [attrName]: ''
                        }
                      }))
                    }
                  }}
                  className="w-full min-h-[44px]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Atributo
                </Button>
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
          {filteredVariants.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="mx-auto h-16 w-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No hay variantes configuradas</p>
              <p className="text-sm">
                {filterStatus !== 'all'
                  ? 'No se encontraron variantes con los filtros aplicados.'
                  : 'Comienza creando tu primera variante para este producto.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Header de tabla */}
              <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg font-medium text-sm">
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={selectedVariants.length === filteredVariants.length && filteredVariants.length > 0}
                    onChange={selectAllVariants}
                    className="rounded border-gray-300"
                  />
                </div>
                <div className="col-span-4">Atributos</div>
                <div className="col-span-2">Precio</div>
                <div className="col-span-2">Stock</div>
                <div className="col-span-2">Estado</div>
                <div className="col-span-1">Acciones</div>
              </div>

              {/* Filas de variantes */}
              {filteredVariants.map((variant) => (
                <div key={variant.id} className="grid grid-cols-12 gap-4 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="col-span-1 flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedVariants.includes(variant.id)}
                      onChange={() => toggleVariantSelection(variant.id)}
                      className="rounded border-gray-300"
                    />
                  </div>

                  <div className="col-span-4 flex items-center gap-3">
                    {variant.images && variant.images.length > 0 && (
                      <div className="flex gap-1">
                        {variant.images.slice(0, 3).map((image, index) => (
                          <Image
                            key={index}
                            src={image}
                            alt={`Variante ${index + 1}`}
                            width={30}
                            height={30}
                            className="w-7.5 h-7.5 object-cover rounded border"
                          />
                        ))}
                        {variant.images.length > 3 && (
                          <div className="w-7.5 h-7.5 bg-gray-200 rounded border flex items-center justify-center text-xs font-medium">
                            +{variant.images.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">
                        {Object.entries(variant.attributes).map(([key, value]) => `${key}: ${value}`).join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="col-span-2 flex items-center">
                    {inlineEditing[variant.id]?.field === 'price' ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={inlineEditing[variant.id].value}
                          onChange={(e) => updateInlineValue(variant.id, parseFloat(e.target.value) || 0)}
                          className="w-20 h-8"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveInlineEdit(variant.id)}
                          className="h-8 w-8 p-0"
                          disabled={inlineLoading[variant.id]}
                        >
                          {inlineLoading[variant.id] ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelInlineEdit(variant.id)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded"
                        onClick={() => startInlineEdit(variant.id, 'price', variant.price || 0)}
                      >
                        {variant.price ? `$${parseFloat(variant.price).toFixed(2)}` : 'Sin precio'}
                      </span>
                    )}
                  </div>

                  <div className="col-span-2 flex items-center">
                    {inlineEditing[variant.id]?.field === 'stock' ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={inlineEditing[variant.id].value}
                          onChange={(e) => updateInlineValue(variant.id, parseInt(e.target.value) || 0)}
                          className="w-20 h-8"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => saveInlineEdit(variant.id)}
                          className="h-8 w-8 p-0"
                          disabled={inlineLoading[variant.id]}
                        >
                          {inlineLoading[variant.id] ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelInlineEdit(variant.id)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded ${
                          variant.stock === 0 ? 'text-red-600 font-medium' : ''
                        }`}
                        onClick={() => startInlineEdit(variant.id, 'stock', variant.stock)}
                      >
                        {variant.stock === 0 ? (
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Agotado
                          </span>
                        ) : (
                          variant.stock
                        )}
                      </span>
                    )}
                  </div>

                  <div className="col-span-2 flex items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleVariantStatus(variant.id, variant.isActive)}
                      className={`min-h-[32px] ${
                        variant.isActive
                          ? 'text-green-600 hover:text-green-700'
                          : 'text-gray-400 hover:text-gray-500'
                      }`}
                    >
                      {variant.isActive ? (
                        <CheckCircle className="h-4 w-4 mr-1" />
                      ) : (
                        <EyeOff className="h-4 w-4 mr-1" />
                      )}
                      {variant.isActive ? 'Activa' : 'Inactiva'}
                    </Button>
                  </div>

                  <div className="col-span-1 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(variant)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteDialog({ isOpen: true, variantId: variant.id })}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        title="Eliminar Variante"
        description={
          deleteDialog.variantId === null && selectedVariants.length > 0
            ? `¿Estás seguro de que quieres eliminar ${selectedVariants.length} variante${selectedVariants.length !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`
            : "Estás seguro de que quieres eliminar esta variante? Esta acción no se puede deshacer."
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={deleteDialog.variantId === null ? bulkDelete : handleDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, variantId: null })}
      />
    </Card>
  )
}
