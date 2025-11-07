'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Plus, X, Tag, GripVertical, Edit3, Check, AlertCircle } from 'lucide-react'

export interface DynamicAttribute {
  name: string
  values: string[]
}

interface AttributeBuilderProps {
  attributes: DynamicAttribute[]
  onChange: (attributes: DynamicAttribute[]) => void
}

export function AttributeBuilder({ attributes, onChange }: AttributeBuilderProps) {
  const [newAttributeName, setNewAttributeName] = useState('')
  const [newAttributeValue, setNewAttributeValue] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [animatingItems, setAnimatingItems] = useState<Set<number>>(new Set())

  const addAttribute = () => {
    if (!newAttributeName.trim() || !newAttributeValue.trim()) return

    const newAttribute: DynamicAttribute = {
      name: newAttributeName.trim(),
      values: [newAttributeValue.trim()]
    }

    const newIndex = attributes.length
    setAnimatingItems(prev => new Set(prev).add(newIndex))
    onChange([...attributes, newAttribute])
    setNewAttributeName('')
    setNewAttributeValue('')

    // Remove animation class after animation completes
    setTimeout(() => {
      setAnimatingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(newIndex)
        return newSet
      })
    }, 300)
  }

  const removeAttribute = (index: number) => {
    const newAttributes = attributes.filter((_, i) => i !== index)
    onChange(newAttributes)
  }

  const updateAttribute = (index: number, field: keyof DynamicAttribute, value: string | string[]) => {
    const newAttributes = attributes.map((attr, i) =>
      i === index ? { ...attr, [field]: value } : attr
    )
    onChange(newAttributes)
  }

  const addValueToAttribute = (index: number, value: string) => {
    if (!value.trim()) return
    const newValues = [...attributes[index].values, value.trim()]
    updateAttribute(index, 'values', newValues)
  }

  const removeValueFromAttribute = (attrIndex: number, valueIndex: number) => {
    const newValues = attributes[attrIndex].values.filter((_, i) => i !== valueIndex)
    updateAttribute(attrIndex, 'values', newValues)
  }

  const startEditingValue = (index: number) => {
    setEditingIndex(index)
    setEditingValue('')
  }

  const saveEditingValue = () => {
    if (editingIndex !== null && editingValue.trim()) {
      addValueToAttribute(editingIndex, editingValue.trim())
      setEditingIndex(null)
      setEditingValue('')
    }
  }

  const cancelEditingValue = () => {
    setEditingIndex(null)
    setEditingValue('')
  }

  const updateEditingValue = (value: string) => {
    setEditingValue(value)
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === dropIndex) return

    const newAttributes = [...attributes]
    const draggedItem = newAttributes[draggedIndex]
    newAttributes.splice(draggedIndex, 1)
    newAttributes.splice(dropIndex, 0, draggedItem)

    onChange(newAttributes)
    setDraggedIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const validateAttribute = (name: string, values: string[]) => {
    const errors = []
    if (!name.trim()) errors.push('Nombre requerido')
    if (values.length === 0) errors.push('Al menos un valor requerido')
    return errors
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Tag className="h-5 w-5 text-blue-600" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Atributos Dinámicos</h3>
        <span className="text-sm text-gray-500">({attributes.length} atributos)</span>
      </div>

      {/* Lista de atributos existentes */}
      {attributes.length > 0 && (
        <div className="space-y-4">
          {attributes.map((attribute, index) => {
            const errors = validateAttribute(attribute.name, attribute.values)
            return (
              <div
                key={index}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`p-6 border-2 rounded-xl transition-all duration-300 cursor-move group animate-in fade-in slide-in-from-bottom-2 ${
                  draggedIndex === index
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg scale-105'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 hover:shadow-md hover:scale-[1.02] focus-within:ring-2 focus-within:ring-blue-500/20'
                } ${errors.length > 0 ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''} ${animatingItems.has(index) ? 'animate-pulse' : ''}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
                    <Input
                      value={attribute.name}
                      onChange={(e) => updateAttribute(index, 'name', e.target.value)}
                      placeholder="Nombre del atributo (ej: Talla)"
                      className="font-semibold text-lg border-none bg-transparent p-0 focus:ring-0"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttribute(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 min-h-[36px]"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {errors.length > 0 && (
                  <div className="mb-3 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-700 dark:text-red-300">
                        {errors.join(', ')}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Valor del Atributo
                    </label>
                    {editingIndex !== index && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => startEditingValue(index)}
                        className="min-h-[32px]"
                      >
                        <Edit3 className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    )}
                  </div>

                  {editingIndex === index ? (
                    <div className="space-y-3">
                      <Input
                        value={editingValue}
                        onChange={(e) => updateEditingValue(e.target.value)}
                        placeholder="Valor del atributo"
                        className="flex-1"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={saveEditingValue}
                          className="min-h-[36px]"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={cancelEditingValue}
                          className="min-h-[36px]"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {attribute.values.map((value, valueIndex) => (
                        <span key={valueIndex} className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 transition-colors hover:bg-blue-200 dark:hover:bg-blue-800">
                          {value}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeValueFromAttribute(index, valueIndex)}
                            className="ml-1 h-4 w-4 p-0 text-blue-600 hover:text-blue-800"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Formulario para agregar nuevo atributo */}
      <div className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800/50 transition-colors hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">
        <h4 className="font-semibold mb-4 text-gray-900 dark:text-gray-100">Agregar Nuevo Atributo</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
              Nombre del Atributo *
            </label>
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-white dark:bg-gray-800 transition-all duration-200 hover:shadow-md focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:shadow-lg focus-within:scale-[1.02]">
              <Tag className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <Input
                value={newAttributeName}
                onChange={(e) => setNewAttributeName(e.target.value)}
                placeholder="Ej: Color, Talla, Material..."
                className="font-semibold text-lg border-none bg-transparent p-0 focus:ring-0 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Valor del Atributo *
            </label>
            <Input
              value={newAttributeValue}
              onChange={(e) => setNewAttributeValue(e.target.value)}
              placeholder="ej: Rojo"
              className="transition-colors focus:border-blue-500"
            />
          </div>
        </div>
        <Button
          type="button"
          onClick={addAttribute}
          disabled={!newAttributeName.trim() || !newAttributeValue.trim()}
          className="min-h-[44px] bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Atributo
        </Button>
      </div>
    </div>
  )
}
