'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Plus, X, Tag, GripVertical, AlertCircle } from 'lucide-react'

export interface DynamicAttribute {
  name: string
  values: string[]
}

interface RecommendedAttribute {
  key: string
  label: string
  aliases: string[]
  required?: boolean
}

interface AttributeBuilderProps {
  attributes: DynamicAttribute[]
  onChange: (attributes: DynamicAttribute[]) => void
  recommendedAttributes?: RecommendedAttribute[]
}

export function AttributeBuilder({ attributes, onChange, recommendedAttributes = [] }: AttributeBuilderProps) {
  const [newAttributeName, setNewAttributeName] = useState('')
  const [newAttributeValue, setNewAttributeValue] = useState('')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const normalizeName = (value: string) => value.trim().toLowerCase()
  const isRecommendedPresent = (aliases: string[]) =>
    attributes.some((attr) =>
      aliases.some((alias) => normalizeName(attr.name) === normalizeName(alias))
    )

  const addAttribute = () => {
    if (!newAttributeName.trim() || !newAttributeValue.trim()) return

    const newAttribute: DynamicAttribute = {
      name: newAttributeName.trim(),
      values: [newAttributeValue.trim()]
    }

    onChange([...attributes, newAttribute])
    setNewAttributeName('')
    setNewAttributeValue('')
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
    const firstValue = values[0]?.trim() || ''
    if (!firstValue) errors.push('Valor requerido')
    return errors
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Atributos dinámicos</h3>
        <span className="text-xs text-gray-500">({attributes.length} atributos)</span>
      </div>

      {recommendedAttributes.length > 0 && (
        <div className="rounded-md border border-dashed p-3 space-y-2">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Atributos recomendados por Mercado Libre para esta categoría
          </p>
          <div className="flex flex-wrap gap-2">
            {recommendedAttributes.map((attr) => {
              const present = isRecommendedPresent(attr.aliases)
              return (
                <span
                  key={attr.key}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border text-gray-600 dark:text-gray-300 ${
                    present ? 'border-emerald-400' : 'border-amber-400'
                  }`}
                >
                  {attr.label}
                  {attr.required && (
                    <span className="ml-1 text-[10px] font-semibold">
                      (obligatorio)
                    </span>
                  )}
                  <span
                    className={`ml-2 h-1.5 w-1.5 rounded-full ${
                      present ? 'bg-emerald-500' : 'bg-amber-400'
                    }`}
                  />
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista de atributos existentes */}
      {attributes.length > 0 && (
        <div className="space-y-3">
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
                className={`rounded-lg border bg-white dark:bg-gray-900 p-4 cursor-move group ${
                  draggedIndex === index
                    ? 'border-gray-400'
                    : 'border-gray-200 dark:border-gray-700'
                } ${errors.length > 0 ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-gray-300" />
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <Input
                        value={attribute.name}
                        onChange={(e) => updateAttribute(index, 'name', e.target.value)}
                        placeholder="Ej: Color, Talla, Material..."
                        className="h-8 border-0 bg-transparent p-0 text-sm font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
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

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                    Valor del atributo
                  </label>
                  <Input
                    value={attribute.values[0] ?? ''}
                    onChange={(e) => updateAttribute(index, 'values', [e.target.value])}
                    placeholder="Valor del atributo"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Formulario para agregar nuevo atributo */}
      <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-4">
        <h4 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">Agregar nuevo atributo</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
              Nombre del Atributo *
            </label>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <Input
                value={newAttributeName}
                onChange={(e) => setNewAttributeName(e.target.value)}
                placeholder="Ej: Color, Talla, Material..."
                className="h-8 border-0 bg-transparent p-0 text-sm font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
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
            />
          </div>
        </div>
        <Button
          type="button"
          onClick={addAttribute}
          disabled={!newAttributeName.trim() || !newAttributeValue.trim()}
          className="min-h-[40px] px-4"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Atributo
        </Button>
      </div>
    </div>
  )
}
