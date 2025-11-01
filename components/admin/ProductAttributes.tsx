'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { Plus, Edit, Trash2, Settings } from 'lucide-react'

interface ProductAttribute {
  id: number
  name: string
  values: string[]
}

export function ProductAttributes() {
  const [attributes, setAttributes] = useState<ProductAttribute[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAttribute, setEditingAttribute] = useState<ProductAttribute | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; attributeId: number | null }>({
    isOpen: false,
    attributeId: null
  })
  const [formData, setFormData] = useState({
    name: '',
    values: [''] as string[]
  })
  const { toast } = useToast()

  const fetchAttributes = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/product-attributes')
      if (response.ok) {
        const data = await response.json()
        setAttributes(data)
      }
    } catch (error) {
      console.error('Error fetching attributes:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los atributos',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchAttributes()
  }, [fetchAttributes])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Filtrar valores vacíos
    const filteredValues = formData.values.filter(v => v.trim() !== '')

    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre del atributo es requerido',
        variant: 'destructive'
      })
      return
    }

    if (filteredValues.length === 0) {
      toast({
        title: 'Error',
        description: 'Debe agregar al menos un valor',
        variant: 'destructive'
      })
      return
    }

    try {
      const method = editingAttribute ? 'PUT' : 'POST'
      const body = editingAttribute
        ? { id: editingAttribute.id, name: formData.name, values: filteredValues }
        : { name: formData.name, values: filteredValues }

      const response = await fetch('/api/admin/product-attributes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar el atributo')
      }

      toast({
        title: 'Éxito',
        description: `Atributo ${editingAttribute ? 'actualizado' : 'creado'} correctamente`
      })

      fetchAttributes()
      resetForm()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo guardar el atributo',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteDialog.attributeId) return

    try {
      const response = await fetch(`/api/admin/product-attributes?id=${deleteDialog.attributeId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Error al eliminar el atributo')
      }

      toast({
        title: 'Éxito',
        description: 'Atributo eliminado correctamente'
      })

      fetchAttributes()
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el atributo',
        variant: 'destructive'
      })
    } finally {
      setDeleteDialog({ isOpen: false, attributeId: null })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      values: ['']
    })
    setEditingAttribute(null)
    setShowForm(false)
  }

  const startEdit = (attribute: ProductAttribute) => {
    setFormData({
      name: attribute.name,
      values: [...attribute.values, ''] // Agregar un campo vacío para nuevos valores
    })
    setEditingAttribute(attribute)
    setShowForm(true)
  }

  const addValueField = () => {
    setFormData(prev => ({
      ...prev,
      values: [...prev.values, '']
    }))
  }

  const updateValue = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      values: prev.values.map((v, i) => i === index ? value : v)
    }))
  }

  const removeValueField = (index: number) => {
    if (formData.values.length > 1) {
      setFormData(prev => ({
        ...prev,
        values: prev.values.filter((_, i) => i !== index)
      }))
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Atributos de Productos</CardTitle>
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
          <CardTitle>Atributos de Productos</CardTitle>
          <Button onClick={() => setShowForm(!showForm)} className="min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? 'Cancelar' : 'Nuevo Atributo'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Formulario */}
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
            <h3 className="font-semibold">
              {editingAttribute ? 'Editar Atributo' : 'Nuevo Atributo'}
            </h3>

            <div>
              <label className="block text-sm font-medium mb-2">Nombre del Atributo</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Talla, Color, Material"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Valores</label>
              <div className="space-y-2">
                {formData.values.map((value, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={value}
                      onChange={(e) => updateValue(index, e.target.value)}
                      placeholder={`Valor ${index + 1}`}
                      className="flex-1"
                    />
                    {formData.values.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeValueField(index)}
                        className="min-h-[44px]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addValueField}
                  className="w-full min-h-[44px]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Valor
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="min-h-[44px]">
                {editingAttribute ? 'Actualizar' : 'Crear'} Atributo
              </Button>
              <Button type="button" variant="outline" onClick={resetForm} className="min-h-[44px]">
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {/* Lista de atributos */}
        <div className="space-y-4">
          {attributes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Settings className="mx-auto h-12 w-12 mb-4" />
              <p>No hay atributos configurados.</p>
              <p className="text-sm">Crea atributos como &quot;Talla&quot;, &quot;Color&quot;, etc. para usar en las variantes de productos.</p>
            </div>
          ) : (
            attributes.map((attribute) => (
              <div key={attribute.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h3 className="font-medium">{attribute.name}</h3>
                  <p className="text-sm text-gray-600">
                    Valores: {attribute.values.join(', ')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(attribute)}
                    className="min-h-[36px]"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialog({ isOpen: true, attributeId: attribute.id })}
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
        title="Eliminar Atributo"
        description="¿Estás seguro de que quieres eliminar este atributo? Esto puede afectar a las variantes de productos existentes."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ isOpen: false, attributeId: null })}
      />
    </Card>
  )
}
