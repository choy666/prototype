'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ArrowLeft, Save, Package, History, AlertTriangle, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { adjustStock, adjustVariantStock, getStockLogs, bulkAdjustVariantStock } from '@/lib/actions/stock'
import { logger } from '@/lib/utils/logger'
import { StockErrorBoundary } from '@/components/ui/stock-error-boundary'

interface Product {
  id: number
  name: string
  stock: number
}

interface ProductVariant {
  id: number
  attributes: Record<string, string>
  stock: number
}

interface StockLog {
  id: number
  productId: number
  productName: string | null
  oldStock: number
  newStock: number
  change: number
  reason: string
  created_at: Date
  userName: string | null
}

export default function ProductStockPage() {
  const router = useRouter()
  const params = useParams()
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [stockLogs, setStockLogs] = useState<StockLog[]>([])
  const [productStock, setProductStock] = useState('')
  const [variantStocks, setVariantStocks] = useState<Record<number, string>>({})

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: '' as 'product' | 'variant' | 'bulk' | '',
    variantId: 0,
    newStock: 0,
    bulkVariants: [] as Array<{ variantId: number; newStock: number }>
  })

  const [bulkMode, setBulkMode] = useState(false)
  const [bulkStock, setBulkStock] = useState('')
  const [stockLogsOffset, setStockLogsOffset] = useState(0)
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, number>>({}) // Para rollback

  const id = params.id as string

  useEffect(() => {
    const fetchData = async () => {
      try {
        setFetchLoading(true)
        setFetchError(null)

        // Fetch product
        const productRes = await fetch(`/api/admin/products/${id}`)
        if (!productRes.ok) {
          if (productRes.status === 401) {
            toast({
              title: 'No autorizado',
              description: 'Debes ser admin para acceder',
              variant: 'destructive'
            })
            router.push('/admin')
            return
          } else if (productRes.status === 404) {
            toast({
              title: 'Producto no encontrado',
              description: 'El producto solicitado no existe',
              variant: 'destructive'
            })
            router.push('/admin/products')
            return
          }
          throw new Error('Failed to fetch product')
        }
        const productData = await productRes.json()
        setProduct(productData)
        setProductStock(productData.stock.toString())

        // Fetch variants
        try {
          const variantsRes = await fetch(`/api/admin/products/${id}/variants`)
          if (variantsRes.ok) {
            const variantsData = await variantsRes.json()
            // Validar y filtrar variants con attributes válidos
            const validVariants = variantsData.filter((variant: ProductVariant) => 
              variant && typeof variant === 'object' && variant.id && (typeof variant.attributes === 'object' || variant.attributes === null)
            )
            if (variantsData.length !== validVariants.length) {
              console.error('Invalid attributes in some variants:', variantsData.filter((v: ProductVariant) => !validVariants.includes(v)))
            }
            setVariants(validVariants)
            const initialVariantStocks: Record<number, string> = {}
            validVariants.forEach((variant: ProductVariant) => {
              initialVariantStocks[variant.id] = variant.stock.toString()
            })
            setVariantStocks(initialVariantStocks)
          } else if (variantsRes.status === 404) {
            setVariants([])
          } else {
            logger.warn('Failed to fetch variants', {
              productId: parseInt(id),
              status: variantsRes.status,
              statusText: variantsRes.statusText
            })
            setVariants([])
          }
        } catch (variantError) {
          logger.error('Error fetching variants', {
            productId: parseInt(id),
            error: variantError instanceof Error ? variantError.message : 'Unknown error'
          })
          setVariants([])
        }

        // Fetch stock logs
        try {
          const logs = await getStockLogs(parseInt(id), 50)
          setStockLogs(logs)
        } catch (logError) {
          logger.error('Error fetching stock logs', {
            productId: parseInt(id),
            error: logError instanceof Error ? logError.message : 'Unknown error'
          })
          setStockLogs([])
        }

        // Log access to product stock
        logger.info('Access to product stock page', {
          productId: parseInt(id),
          productName: productData.name,
          stock: productData.stock,
          userId: session?.user?.id,
          userRole: session?.user?.role
        })
      } catch (error) {
        logger.error('Error fetching product data', {
          productId: parseInt(id),
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: session?.user?.id
        })
        console.error('Error fetching data:', error)
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
        setFetchError(errorMessage)
        toast({
          title: 'Error de conexión',
          description: 'No se pudieron cargar los datos. Verifica tu conexión o recarga la página.',
          variant: 'destructive'
        })
        // No redirigir automáticamente para permitir retry
      } finally {
        setFetchLoading(false)
      }
    }

    if (id) fetchData()
  }, [id, router, toast, session])

  const confirmProductUpdate = () => {
    if (!product) return

    const newStock = parseInt(productStock)
    if (isNaN(newStock) || newStock < 0) {
      toast({
        title: 'Error',
        description: 'Stock inválido. Debe ser un número positivo.',
        variant: 'destructive'
      })
      return
    }

    if (newStock > 999999) {
      toast({
        title: 'Error',
        description: 'El stock no puede exceder 999,999 unidades.',
        variant: 'destructive'
      })
      return
    }

    // Warning si reduce stock significativamente
    if (newStock < product.stock * 0.5 && product.stock > 10) {
      toast({
        title: 'Advertencia',
        description: 'Esto reducirá significativamente el stock disponible. ¿Continuar?',
        variant: 'default'
      })
    }

    setConfirmDialog({
      isOpen: true,
      type: 'product',
      variantId: 0,
      newStock,
      bulkVariants: []
    })
  }

  const confirmVariantUpdate = (variantId: number) => {
    const newStock = parseInt(variantStocks[variantId])
    if (isNaN(newStock) || newStock < 0) {
      toast({
        title: 'Error',
        description: 'Stock inválido. Debe ser un número positivo.',
        variant: 'destructive'
      })
      return
    }

    if (newStock > 999999) {
      toast({
        title: 'Error',
        description: 'El stock no puede exceder 999,999 unidades.',
        variant: 'destructive'
      })
      return
    }

    // Warning si reduce stock significativamente
    const currentVariantStock = variants.find(v => v.id === variantId)?.stock || 0
    if (newStock < currentVariantStock * 0.5 && currentVariantStock > 10) {
      toast({
        title: 'Advertencia',
        description: 'Esto reducirá significativamente el stock de la variante. ¿Continuar?',
        variant: 'default'
      })
    }

    setConfirmDialog({
      isOpen: true,
      type: 'variant',
      variantId,
      newStock,
      bulkVariants: []
    })
  }

  const confirmBulkUpdate = () => {
    const newStock = parseInt(bulkStock)
    if (isNaN(newStock) || newStock < 0) {
      toast({
        title: 'Error',
        description: 'Stock bulk inválido. Debe ser un número positivo.',
        variant: 'destructive'
      })
      return
    }

    if (newStock > 999999) {
      toast({
        title: 'Error',
        description: 'El stock bulk no puede exceder 999,999 unidades.',
        variant: 'destructive'
      })
      return
    }

    const bulkVariants = variants.map(v => ({ variantId: v.id, newStock }))
    setConfirmDialog({
      isOpen: true,
      type: 'bulk',
      variantId: 0,
      newStock,
      bulkVariants
    })
  }

  const handleConfirmUpdate = async () => {
    if (!session?.user?.id || session.user.role !== 'admin') {
      toast({
        title: 'No autorizado',
        description: 'Debes ser administrador para realizar esta acción',
        variant: 'destructive'
      })
      setConfirmDialog({ isOpen: false, type: '', variantId: 0, newStock: 0, bulkVariants: [] })
      return
    }

    const userId = parseInt(session.user.id)
    if (isNaN(userId)) {
      toast({
        title: 'Error',
        description: 'ID de usuario inválido',
        variant: 'destructive'
      })
      setConfirmDialog({ isOpen: false, type: '', variantId: 0, newStock: 0, bulkVariants: [] })
      return
    }

    setLoading(true)
    try {
      let successMessage = ''
      if (confirmDialog.type === 'product' && product) {
        // Optimistic update
        setOptimisticUpdates(prev => ({ ...prev, product: confirmDialog.newStock }))
        setProductStock(confirmDialog.newStock.toString())

        await adjustStock(product.id, confirmDialog.newStock, 'Actualización manual', userId)
        successMessage = 'Stock del producto actualizado correctamente'
      } else if (confirmDialog.type === 'variant') {
        // Optimistic update
        setOptimisticUpdates(prev => ({ ...prev, [`variant-${confirmDialog.variantId}`]: confirmDialog.newStock }))
        setVariantStocks(prev => ({ ...prev, [confirmDialog.variantId]: confirmDialog.newStock.toString() }))

        await adjustVariantStock(confirmDialog.variantId, confirmDialog.newStock, 'Actualización manual', userId)
        successMessage = 'Stock de la variante actualizado correctamente'
      } else if (confirmDialog.type === 'bulk' && variants.length > 0) {
        // Optimistic bulk
        const bulkVariants = confirmDialog.bulkVariants
        bulkVariants.forEach(({ variantId, newStock }) => {
          setOptimisticUpdates(prev => ({ ...prev, [`variant-${variantId}`]: newStock }))
          setVariantStocks(prev => ({ ...prev, [variantId]: newStock.toString() }))
        })

        await bulkAdjustVariantStock(bulkVariants, 'Actualización bulk manual', userId)
        successMessage = `Stock de ${bulkVariants.length} variantes actualizado correctamente`
      }

      toast({
        title: 'Éxito',
        description: successMessage
      })

      // Refresh logs
      const logs = await getStockLogs(parseInt(id), 50)
      setStockLogs(logs)
    } catch (error) {
      // Rollback optimistic
      if (confirmDialog.type === 'product' && product) {
        setProductStock(product.stock.toString())
      } else if (confirmDialog.type === 'variant') {
        const originalStock = variants.find(v => v.id === confirmDialog.variantId)?.stock || 0
        setVariantStocks(prev => ({ ...prev, [confirmDialog.variantId]: originalStock.toString() }))
      } else if (confirmDialog.type === 'bulk') {
        variants.forEach(v => {
          setVariantStocks(prev => ({ ...prev, [v.id]: v.stock.toString() }))
        })
      }
      setOptimisticUpdates({})

      console.error(`Error updating ${confirmDialog.type} stock:`, error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `No se pudo actualizar el stock de la ${confirmDialog.type}`,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
      setConfirmDialog({ isOpen: false, type: '', variantId: 0, newStock: 0, bulkVariants: [] })
    }
  }

  const loadMoreLogs = async () => {
    try {
      const newOffset = stockLogsOffset + 50
      const moreLogs = await getStockLogs(parseInt(id), 50, newOffset)
      if (moreLogs.length > 0) {
        setStockLogs(prev => [...prev, ...moreLogs])
        setStockLogsOffset(newOffset)
      }
    } catch (error) {
      logger.error('Error loading more stock logs', {
        productId: parseInt(id),
        offset: stockLogsOffset,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      toast({
        title: 'Error',
        description: 'No se pudieron cargar más registros del historial',
        variant: 'destructive'
      })
    }
  }

  if (fetchLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-24" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        <h2 className="mt-4 text-xl font-semibold">¡Ups! Algo salió mal</h2>
        <p className="mt-2 text-gray-600">
        Se produjo un error inesperado al cargar los datos.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          {fetchError}
        </p>
        <Button onClick={() => window.location.reload()} className="mt-6">
          <RefreshCw className="mr-2 h-4 w-4" />
          Recargar la página
        </Button>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Producto no encontrado</p>
      </div>
    )
  }

  return (
    <StockErrorBoundary productId={id}>
      <div className="space-y-6">
        <Breadcrumb items={[
          { label: 'Productos', href: '/admin/products' },
          { label: product.name, href: `/admin/products/${id}/edit` },
          { label: 'Gestión de Stock' }
        ]} />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href={`/admin/products/${id}/edit`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Gestión de Stock</h1>
              <p className="text-muted-foreground">
                Gestiona el stock de {product.name}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Stock */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Stock del Producto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="productStock">Stock Actual</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="productStock"
                    type="number"
                    min="0"
                    value={productStock}
                    onChange={(e) => setProductStock(e.target.value)}
                    placeholder="0"
                  />
                  <Button
                    onClick={confirmProductUpdate}
                    disabled={loading}
                    className="min-h-[44px]"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Actualizar
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Stock actual: {optimisticUpdates.product || product.stock}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Variants Stock */}
          {variants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Stock de Variantes
                </CardTitle>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Modo Bulk</Label>
                  <Button
                    variant={bulkMode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBulkMode(!bulkMode)}
                  >
                    {bulkMode ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {bulkMode ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {bulkMode && (
                  <div className="border rounded-lg p-4 bg-blue-50">
                    <Label>Stock para todas las variantes</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="number"
                        min="0"
                        value={bulkStock}
                        onChange={(e) => setBulkStock(e.target.value)}
                        placeholder="0"
                        className="flex-1"
                      />
                      <Button
                        onClick={confirmBulkUpdate}
                        disabled={loading || !bulkStock}
                        size="sm"
                        className="min-h-[44px]"
                      >
                        <Save className="h-4 w-4" />
                        Aplicar Bulk
                      </Button>
                    </div>
                  </div>
                )}
                {variants.map((variant) => (
                  <div key={variant.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">
                        {Object.entries(variant.attributes || {}).length > 0 
                          ? Object.entries(variant.attributes || {}).map(([key, value]) => `${key}: ${value}`).join(', ')
                          : 'Sin atributos'
                        }
                      </span>
                      <span className={`text-sm px-2 py-1 rounded ${
                        (optimisticUpdates[`variant-${variant.id}`] || variant.stock) === 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {(optimisticUpdates[`variant-${variant.id}`] || variant.stock) === 0 ? (
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Agotado
                          </span>
                        ) : (
                          `${optimisticUpdates[`variant-${variant.id}`] || variant.stock} unidades`
                        )}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        value={variantStocks[variant.id] || ''}
                        onChange={(e) => setVariantStocks(prev => ({
                          ...prev,
                          [variant.id]: e.target.value
                        }))}
                        placeholder="0"
                        className="flex-1"
                        disabled={bulkMode}
                      />
                      <Button
                        onClick={() => confirmVariantUpdate(variant.id)}
                        disabled={loading || bulkMode}
                        size="sm"
                        className="min-h-[44px]"
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Stock History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de Cambios de Stock
            </CardTitle>
            {stockLogs.length >= 50 && (
              <Button variant="outline" size="sm" onClick={loadMoreLogs} disabled={loading}>
                Cargar más
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {stockLogs.length === 0 ? (
              <p className="text-center py-8 text-gray-500">
                No hay registros de cambios de stock
              </p>
            ) : (
              <div className="space-y-2">
                {stockLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{log.productName || 'Producto'}</p>
                      <p className="text-sm text-gray-600">{log.reason} por {log.userName || 'Usuario desconocido'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {log.oldStock} → {log.newStock}
                        <span className={`ml-2 px-2 py-1 text-xs rounded ${
                          log.change > 0 ? 'bg-green-100 text-green-800' :
                          log.change < 0 ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {log.change > 0 ? '+' : ''}{log.change}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(log.created_at || new Date()).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <ConfirmationDialog
          isOpen={confirmDialog.isOpen}
          title={`Confirmar actualización de ${confirmDialog.type === 'bulk' ? 'stock bulk' : confirmDialog.type}`}
          description={
            confirmDialog.type === 'bulk'
              ? `¿Estás seguro de que quieres actualizar el stock de ${confirmDialog.bulkVariants.length} variantes a ${confirmDialog.newStock} unidades cada una?`
              : `¿Estás seguro de que quieres actualizar el stock a ${confirmDialog.newStock} unidades?`
          }
          confirmText="Confirmar actualización"
          cancelText="Cancelar"
          onConfirm={handleConfirmUpdate}
          onCancel={() => setConfirmDialog({ isOpen: false, type: '', variantId: 0, newStock: 0, bulkVariants: [] })}
        />
      </div>
    </StockErrorBoundary>
  )
}
