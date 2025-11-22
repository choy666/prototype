'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'

import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { debounce } from '@/lib/utils'
import {
  Plus,
  Edit,
  Search,
  Package,
  Settings,
  X,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react'
import { ProductSyncButton } from '@/components/admin/ProductSyncButton';

interface Product {
  id: number
  name: string
  price: string
  image?: string
  category: string
  stock: number
  discount: number
  destacado: boolean
  isActive: boolean
  created_at: string
  mlItemId?: string | null
  mlSyncStatus?: string
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
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<ApiResponse['pagination'] | null>(null)

  const [filters, setFilters] = useState({
    category: '',
    minPrice: '',
    maxPrice: '',
    minStock: '',
    maxStock: '',
    minDiscount: '',
    featured: '',
  })
  const [showFilters] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; productId: number | null; productName: string }>({
    isOpen: false,
    productId: null,
    productName: ''
  })
  const { toast } = useToast()
  const observerRef = useRef<HTMLDivElement>(null)

  const fetchProducts = useCallback(async (searchTerm = '', pageNum = 1, append = false) => {
    try {
      if (!append) setLoading(true)
      else setLoadingMore(true)
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '10',
        ...(searchTerm && { search: searchTerm }),
        ...(filters.category && { category: filters.category }),
        ...(filters.minPrice && { minPrice: filters.minPrice }),
        ...(filters.maxPrice && { maxPrice: filters.maxPrice }),
        ...(filters.minStock && { minStock: filters.minStock }),
        ...(filters.maxStock && { maxStock: filters.maxStock }),
        ...(filters.minDiscount && { minDiscount: filters.minDiscount }),
        ...(filters.featured && { featured: filters.featured }),
      })
      const response = await fetch(`/api/admin/products?${params}`)
      if (!response.ok) throw new Error('Failed to fetch products')
      const data: ApiResponse = await response.json()
      if (append) {
        setProducts(prev => [...prev, ...data.data])
      } else {
        setProducts(data.data)
      }
      setPagination(data.pagination)
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los productos',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [toast, filters])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Debounced search
  useEffect(() => {
    const debouncedSearch = debounce(() => {
      setProducts([])
      setPage(1)
      fetchProducts(search, 1)
    }, 300)
    debouncedSearch()
    return () => {
      // Cleanup
    }
  }, [search, filters, fetchProducts])

  // Infinite scroll
  useEffect(() => {
    if (!observerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && pagination && page < pagination.totalPages) {
          setPage(prev => prev + 1)
          fetchProducts(search, page + 1, true)
        }
      },
      { threshold: 1.0 }
    )

    observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [loading, loadingMore, pagination, page, search, fetchProducts])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => Math.min(prev + 1, products.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => Math.max(prev - 1, -1))
          break
        case 'Enter':
          if (selectedIndex >= 0 && products[selectedIndex]) {
            window.location.href = `/admin/products/${products[selectedIndex].id}/edit`
          }
          break
        case 'Escape':
          setSelectedIndex(-1)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, products])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchProducts(search, 1)
    setPage(1)
  }



  const handleToggleActive = async (productId: number, newStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/products/${productId}/toggle-active`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to toggle product status')
      }

      toast({
        title: 'Éxito',
        description: `Producto ${newStatus ? 'activado' : 'desactivado'} correctamente`
      })

      // Update the product in the local state
      setProducts(prev => prev.map(product =>
        product.id === productId
          ? { ...product, isActive: newStatus }
          : product
      ))
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo cambiar el estado del producto',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteClick = (productId: number) => {
    const product = products.find(p => p.id === productId)
    if (product) {
      setDeleteDialog({ isOpen: true, productId, productName: product.name })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeleteConfirm = async () => {
    if (!deleteDialog.productId) return

    try {
      const response = await fetch(`/api/admin/products/${deleteDialog.productId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete product')
      }

      toast({
        title: 'Éxito',
        description: 'Producto eliminado correctamente'
      })

      // Remove the product from the local state
      setProducts(prev => prev.filter(product => product.id !== deleteDialog.productId))
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo eliminar el producto',
        variant: 'destructive'
      })
    } finally {
      setDeleteDialog({ isOpen: false, productId: null, productName: '' })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, productId: null, productName: '' })
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Productos' }]} />
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Productos</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gestiona el catálogo de productos de tu tienda
          </p>
        </div>
        <Link href="/admin/products/new">
          <Button className="w-full sm:w-auto min-h-[44px] border">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Producto
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar y Filtrar Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
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
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/50">
                <div>
                  <label className="text-sm font-medium">Categoría</label>
                  <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas</SelectItem>
                      {/* Add categories here */}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Precio Mín</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.minPrice}
                    onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Precio Máx</label>
                  <Input
                    type="number"
                    placeholder="1000"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Stock Mín</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.minStock}
                    onChange={(e) => setFilters(prev => ({ ...prev, minStock: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Stock Máx</label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={filters.maxStock}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxStock: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Descuento Mín (%)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.minDiscount}
                    onChange={(e) => setFilters(prev => ({ ...prev, minDiscount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Destacado</label>
                  <Select value={filters.featured} onValueChange={(value) => setFilters(prev => ({ ...prev, featured: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="true">Sí</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFilters({
                      category: '',
                      minPrice: '',
                      maxPrice: '',
                      minStock: '',
                      maxStock: '',
                      minDiscount: '',
                      featured: '',
                    })}
                    className="w-full"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Limpiar
                  </Button>
                </div>
              </div>
            )}
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
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {products.map((product) => (
                <div key={product.id} className="p-4 grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                  {/* Product Info */}
                  <div className="md:col-span-2 flex items-center space-x-4">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={`Producto: ${product.name}`}
                        width={64}
                        height={64}
                        sizes="(max-width: 768px) 64px, 64px"
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
                        className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate text-base">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {product.category}
                      </p>
                      <div className="flex items-center text-sm mt-1">
                        Stock: {product.stock}
                        {product.stock === 0 ? (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                            Sin stock
                          </span>
                        ) : product.stock <= 10 && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                            Stock bajo
                          </span>
                        )}
                        {product.isActive ? (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                            Activo
                          </span>
                        ) : (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300">
                            Inactivo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Price and Actions */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between">
                    <div className="text-left md:text-right mb-4 md:mb-2">
                      <p className="font-bold text-lg">
                        ${parseFloat(product.price).toFixed(2)}
                      </p>
                      {product.discount > 0 && (
                        <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded-full">
                          {product.discount}% OFF
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      {/* Mercado Libre Sync Button */}
                      <ProductSyncButton
                        productId={product.id}
                        mlItemId={product.mlItemId}
                        syncStatus={product.mlSyncStatus}
                        onSyncComplete={() => fetchProducts(search, page)}
                      />
                      
                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2">
                        <Link href={`/admin/products/${product.id}/edit`}>
                          <Button variant="outline" size="icon" className="h-9 w-9" aria-label={`Editar ${product.name}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/products/${product.id}/stock`}>
                          <Button variant="outline" size="icon" className="h-9 w-9" aria-label={`Gestionar stock de ${product.name}`}>
                            <Settings className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant={product.isActive ? "outline" : "secondary"}
                          size="icon"
                          onClick={() => handleToggleActive(product.id, !product.isActive)}
                          className="h-9 w-9"
                          aria-label={product.isActive ? `Desactivar ${product.name}` : `Reactivar ${product.name}`}
                        >
                          {product.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDeleteClick(product.id)}
                          className="h-9 w-9"
                          aria-label={`Eliminar ${product.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-center items-center mt-6 gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => {
                  setPage(page - 1)
                  fetchProducts(search, page - 1)
                }}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Anterior
              </Button>
              <span className="px-4 py-2 text-sm sm:text-base">
                Página {page} de {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page === pagination.totalPages}
                onClick={() => {
                  setPage(page + 1)
                  fetchProducts(search, page + 1)
                }}
                className="w-full sm:w-auto min-h-[44px]"
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
        description={`¿Estás seguro de que quieres eliminar "${deleteDialog.productName}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  )
}
