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
import { ArrowLeft, Save, Package, History, AlertTriangle } from 'lucide-react'
import { adjustStock, adjustVariantStock, getStockLogs } from '@/lib/actions/stock'

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
}

export default function ProductStockPage() {
  const router = useRouter()
  const params = useParams()
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [stockLogs, setStockLogs] = useState<StockLog[]>([])
  const [productStock, setProductStock] = useState('')
  const [variantStocks, setVariantStocks] = useState<Record<number, string>>({})

  const id = params.id as string

  useEffect(() => {
    const fetchData = async () => {
      try {
        setFetchLoading(true)

        // Fetch product
        const productRes = await fetch(`/api/admin/products/${id}`)
        if (!productRes.ok) throw new Error('Failed to fetch product')
        const productData = await productRes.json()
        setProduct(productData)
        setProductStock(productData.stock.toString())

        // Fetch variants
        const variantsRes = await fetch(`/api/admin/products/${id}/variants`)
        if (variantsRes.ok) {
          const variantsData = await variantsRes.json()
          setVariants(variantsData)
          const initialVariantStocks: Record<number, string> = {}
          variantsData.forEach((variant: ProductVariant) => {
            initialVariantStocks[variant.id] = variant.stock.toString()
          })
          setVariantStocks(initialVariantStocks)
        }

        // Fetch stock logs
        const logs = await getStockLogs(parseInt(id))
        setStockLogs(logs)
      } catch (error) {
        console.error('Error fetching data:', error)
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos',
          variant: 'destructive'
        })
        router.push('/admin/products')
      } finally {
        setFetchLoading(false)
      }
    }

    if (id) fetchData()
  }, [id, router, toast])

  const handleProductStockUpdate = async () => {
    if (!product || !session?.user?.id) return

    const newStock = parseInt(productStock)
    if (isNaN(newStock) || newStock < 0) {
      toast({
        title: 'Error',
        description: 'Stock inválido',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      await adjustStock(product.id, newStock, 'Actualización manual', parseInt(session.user.id))

      toast({
        title: 'Éxito',
        description: 'Stock del producto actualizado correctamente'
      })

      // Refresh logs
      const logs = await getStockLogs(parseInt(id))
      setStockLogs(logs)
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el stock del producto',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVariantStockUpdate = async (variantId: number) => {
    if (!session?.user?.id) return

    const newStock = parseInt(variantStocks[variantId])
    if (isNaN(newStock) || newStock < 0) {
      toast({
        title: 'Error',
        description: 'Stock inválido',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      await adjustVariantStock(variantId, newStock, 'Actualización manual', parseInt(session.user.id))

      toast({
        title: 'Éxito',
        description: 'Stock de la variante actualizado correctamente'
      })

      // Refresh logs
      const logs = await getStockLogs(parseInt(id))
      setStockLogs(logs)
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el stock de la variante',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
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

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Producto no encontrado</p>
      </div>
    )
  }

  return (
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
                  onClick={handleProductStockUpdate}
                  disabled={loading}
                  className="min-h-[44px]"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Actualizar
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Stock actual: {product.stock}
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
            </CardHeader>
            <CardContent className="space-y-4">
              {variants.map((variant) => (
                <div key={variant.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      {Object.entries(variant.attributes).map(([key, value]) => `${key}: ${value}`).join(', ')}
                    </span>
                    <span className={`text-sm px-2 py-1 rounded ${
                      variant.stock === 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {variant.stock === 0 ? (
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Agotado
                        </span>
                      ) : (
                        `${variant.stock} unidades`
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
                    />
                    <Button
                      onClick={() => handleVariantStockUpdate(variant.id)}
                      disabled={loading}
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
                    <p className="text-sm text-gray-600">{log.reason}</p>
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
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
