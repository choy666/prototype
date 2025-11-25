'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ChevronDown, Search, Tag } from 'lucide-react'
import type { Category } from '@/lib/schema'

interface MLCategorySelectSimpleProps {
  value?: string
  onValueChange: (value: string) => void
  categories: Category[]
  placeholder?: string
  disabled?: boolean
}

export function MLCategorySelectSimple({
  value,
  onValueChange,
  categories,
  placeholder = 'Seleccionar categoría ML',
  disabled = false,
}: MLCategorySelectSimpleProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Filtrar solo categorías oficiales y hoja
  const officialLeafCategories = useMemo(() => {
    return categories.filter(cat => cat.mlCategoryId && cat.isMlOfficial && cat.isLeaf)
  }, [categories])

  // Filtrar categorías basadas en búsqueda
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return officialLeafCategories

    const query = searchQuery.toLowerCase()
    return officialLeafCategories.filter(cat => 
      cat.name.toLowerCase().includes(query) ||
      cat.mlCategoryId?.toLowerCase().includes(query)
    )
  }, [officialLeafCategories, searchQuery])

  // Obtener categoría seleccionada
  const selectedCategory = useMemo(() => {
    if (!value) return null
    return officialLeafCategories.find(cat => cat.mlCategoryId === value)
  }, [value, officialLeafCategories])

  // Limitar resultados para mejor rendimiento
  const displayCategories = filteredCategories.slice(0, 100)

  return (
    <div className="space-y-2">
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-between text-left font-normal h-auto py-2',
            !selectedCategory && 'text-muted-foreground',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
        >
          <div className="flex flex-col items-start">
            {selectedCategory ? (
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-blue-600" />
                <span className="font-medium">{selectedCategory.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {selectedCategory.mlCategoryId}
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <span>{placeholder}</span>
              </div>
            )}
          </div>
          <ChevronDown className={cn('ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform', open && 'rotate-180')} />
        </Button>

        {open && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-80 overflow-hidden">
            {/* Search input */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o ID de categoría..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
            </div>

            {/* Categories list */}
            <div className="max-h-60 overflow-y-auto">
              {displayCategories.length === 0 ? (
                <div className="py-6 text-center text-sm">
                  {searchQuery ? (
                    <>
                      <p className="text-muted-foreground">No se encontraron categorías con &quot;{searchQuery}&quot;</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Intenta con otros términos o verifica que las categorías estén sincronizadas
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground">No hay categorías disponibles</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ve a &quot;Categorías&quot; y usa &quot;Actualizar desde Mercado Libre&quot;
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="p-1">
                  {displayCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        onValueChange(category.mlCategoryId!)
                        setOpen(false)
                        setSearchQuery('')
                      }}
                      className={cn(
                        'w-full flex flex-col items-start px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors',
                        value === category.mlCategoryId && 'bg-accent'
                      )}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Tag className="h-4 w-4 text-blue-600 shrink-0" />
                        <span className="font-medium truncate flex-1 text-left">{category.name}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {category.mlCategoryId}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {filteredCategories.length > 100 && (
                <div className="py-2 px-3 text-xs text-muted-foreground border-t">
                  Mostrando 100 de {filteredCategories.length} categorías. Refina tu búsqueda para ver más resultados.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t bg-muted/30">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
      
      {selectedCategory && (
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Categoría seleccionada:</span>
            <Badge variant="secondary" className="text-xs">
              {selectedCategory.mlCategoryId}
            </Badge>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  )
}
