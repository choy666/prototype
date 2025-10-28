'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Package,
  DollarSign,
  Settings
} from 'lucide-react'

interface Product {
  id: number
  name: string
  price: string
  image?: string
  category: string
  stock: number
  discount: number
  destacado: boolean
  created_at: string
}

interface ApiResponse {
  data: Product[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<ApiResponse['pagination'] | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; productId: number | null }>({
    isOpen: false,
    productId: null
  })
  const { toast } = useToast()

  const fetchProducts = useCallback(async (searchTerm = '', pageNum = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '10',
        ...(searchTerm && { search: searchTerm })
      })
      const response = await fetch(`/api/admin/products?${params}`)
      if (!response.ok) throw new Error('Failed to fetch products')
      const data: ApiResponse = await response.json()
      setProducts(data.data)
      setPagination(data.pagination)
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los productos',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchProducts(search, 1)
    setPage(1)
  }

  const handleDeleteClick = (id: number) => {
    setDeleteDialog({ isOpen: true, productId: id })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.productId) return

    try {
      const response = await fetch(`/api/admin/products/${deleteDialog.productId}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete product')
      }

      toast({
        title: 'Éxito',
        description: 'Producto eliminado correctamente'
      })
      fetchProducts(search, page)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo eliminar el producto'
      const description = errorMessage.includes('órdenes') ? 'El producto tiene órdenes activas' : 'No se pudo eliminar el producto'
      toast({
        title: 'Error',
        description,
        variant: 'destructive'
      })
    } finally {
      setDeleteDialog({ isOpen: false, productId: null })
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, productId: null })
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Productos' }]} />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Productos</h1>
          <p className="text-muted-foreground">
            Gestiona el catálogo de productos de tu tienda
          </p>
        </div>
        <Link href="/admin/products/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Producto
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Productos</CardTitle>
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
          ) : products.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No hay productos</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Comienza creando tu primer producto.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => (
                <div key={product.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg space-y-4 sm:space-y-0 gap-4">
                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={`Producto: ${product.name}`}
                        width={48}
                        height={48}
                        sizes="(max-width: 640px) 48px, 48px"
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
                        className="h-12 w-12 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <Package className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium truncate text-sm sm:text-base">{product.name}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {product.category} • Stock: {product.stock}
                        {product.stock === 0 ? (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                            Sin stock
                          </span>
                        ) : product.stock <= 10 && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                            Stock bajo
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 flex-shrink-0">
                    <div className="text-left sm:text-right">
                      <p className="font-medium text-sm sm:text-base">
                        <DollarSign className="inline h-4 w-4" />
                        {parseFloat(product.price).toFixed(2)}
                      </p>
                      {product.discount > 0 && (
                        <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">
                          -{product.discount}%
                        </p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Link href={`/admin/products/${product.id}/edit`}>
                        <Button variant="outline" size="sm" className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2" aria-label={`Editar ${product.name}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/admin/products/${product.id}/stock`}>
                        <Button variant="outline" size="sm" className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2" aria-label={`Gestionar stock de ${product.name}`}>
                          <Settings className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(product.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 min-h-[44px] min-w-[44px] flex items-center justify-center p-2"
                        aria-label={`Eliminar ${product.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center mt-6 space-x-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => {
                  setPage(page - 1)
                  fetchProducts(search, page - 1)
                }}
              >
                Anterior
              </Button>
              <span className="px-4 py-2">
                Página {page} de {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page === pagination.totalPages}
                onClick={() => {
                  setPage(page + 1)
                  fetchProducts(search, page + 1)
                }}
              >
                Siguiente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        title="Eliminar Producto"
        description="¿Estás seguro de que quieres eliminar este producto? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  )
}
