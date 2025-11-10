'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Tag,
} from 'lucide-react'

interface Category {
  id: number
  name: string
  description?: string
  created_at: string
  updated_at: string
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; categoryId: number | null }>({
    isOpen: false,
    categoryId: null
  })
  const { toast } = useToast()

  const fetchCategories = useCallback(async (searchTerm = '') => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        ...(searchTerm && { search: searchTerm })
      })
      const response = await fetch(`/api/admin/categories?${params}`)
      if (!response.ok) throw new Error('Failed to fetch categories')
      const data: Category[] = await response.json()
      setCategories(data)
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las categorías',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchCategories(search)
  }

  const handleDeleteClick = (id: number) => {
    setDeleteDialog({ isOpen: true, categoryId: id })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.categoryId) return

    try {
      const response = await fetch(`/api/admin/categories/${deleteDialog.categoryId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete category')

      toast({
        title: 'Éxito',
        description: 'Categoría eliminada correctamente'
      })
      fetchCategories(search)
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la categoría',
        variant: 'destructive'
      })
    } finally {
      setDeleteDialog({ isOpen: false, categoryId: null })
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, categoryId: null })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Categorías</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gestiona las categorías de productos de tu tienda
          </p>
        </div>
        <Link href="/admin/categories/new">
          <Button className="w-full sm:w-auto min-h-[44px]">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Categoría
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Categorías</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto min-h-[44px] border">
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Categorías</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8">
              <Tag className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No hay categorías</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Comienza creando tu primera categoría.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map((category) => (
                <div key={category.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg space-y-4 sm:space-y-0 gap-4">
                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                    <div className="h-12 w-12 rounded bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                      <Tag className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm sm:text-base truncate">{category.name}</h3>
                      {category.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <Link href={`/admin/categories/${category.id}/edit`}>
                      <Button variant="outline" size="icon" className="h-9 w-9" aria-label={`Editar ${category.name}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteClick(category.id)}
                      className="h-9 w-9"
                      aria-label={`Eliminar ${category.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        title="Eliminar Categoría"
        description="¿Estás seguro de que quieres eliminar esta categoría? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  )
}
