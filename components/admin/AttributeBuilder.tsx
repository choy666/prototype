'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Plus, X, Tag } from 'lucide-react'

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
  const [newAttributeValues, setNewAttributeValues] = useState('')

  const addAttribute = () => {
    if (!newAttributeName.trim()) return

    const values = newAttributeValues
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0)

    if (values.length === 0) return

    const newAttribute: DynamicAttribute = {
      name: newAttributeName.trim(),
      values
    }

    onChange([...attributes, newAttribute])
    setNewAttributeName('')
    setNewAttributeValues('')
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4" />
        <h3 className="text-lg font-medium">Atributos Dinámicos</h3>
      </div>

      {/* Lista de atributos existentes */}
      {attributes.length > 0 && (
        <div className="space-y-3">
          {attributes.map((attribute, index) => (
            <div key={index} className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center justify-between mb-3">
                <Input
                  value={attribute.name}
                  onChange={(e) => updateAttribute(index, 'name', e.target.value)}
                  placeholder="Nombre del atributo (ej: Talla)"
                  className="font-medium"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => removeAttribute(index)}
                  className="min-h-[36px] ml-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Valores (separados por coma)</label>
                <Input
                  value={attribute.values.join(', ')}
                  onChange={(e) => {
                    const values = e.target.value.split(',').map(v => v.trim()).filter(v => v.length > 0)
                    updateAttribute(index, 'values', values)
                  }}
                  placeholder="ej: S, M, L, XL"
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {attribute.values.map((value, valueIndex) => (
                    <span
                      key={valueIndex}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulario para agregar nuevo atributo */}
      <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
        <h4 className="font-medium mb-3">Agregar Nuevo Atributo</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nombre del Atributo</label>
            <Input
              value={newAttributeName}
              onChange={(e) => setNewAttributeName(e.target.value)}
              placeholder="ej: Color, Material, Estilo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Valores (separados por coma)</label>
            <Input
              value={newAttributeValues}
              onChange={(e) => setNewAttributeValues(e.target.value)}
              placeholder="ej: Rojo, Azul, Verde"
            />
          </div>
        </div>
        <Button
          type="button"
          onClick={addAttribute}
          disabled={!newAttributeName.trim() || !newAttributeValues.trim()}
          className="min-h-[44px]"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Atributo
        </Button>
      </div>
    </div>
  )
}
