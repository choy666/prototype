'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Save, History } from 'lucide-react'

interface Product {
  id: number
  name: string
  stock: number
}

interface StockLog {
  id: number
  productName: string
  oldStock: number
  newStock: number
  change: number
  reason: string
  created_at: string
}

export default function ProductStockPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(true)
  const [product, setProduct] = useState<Product | null>(null)
  const [newStock, setNewStock] = useState('')
  const [reason, setReason] = useState('')
  const [stockLogs, setStockLogs] = useState<StockLog[]>([])

  const id = params.id as string

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch product
        const productResponse = await fetch(`/api/admin/products/${id}`)
        if (!productResponse.ok) throw new Error('Failed to fetch product')
        const productData: Product = await productResponse.json()
        setProduct(productData)
        setNewStock(productData.stock.toString())

        // Fetch stock logs
        const logsResponse = await fetch(`/api/admin/stock?productId=${id}`)
        if (logsResponse.ok) {
          const logsData: StockLog[] = await logsResponse.json()
          setStockLogs(logsData)
        }
      } catch {
        toast({
          title: 'Error',
          description: 'No se pudo cargar la información del producto',
          variant: 'destructive'
        })
        router.push('/admin/products')
      } finally {
        setFetchLoading(false)
      }
    }

    if (id) fetchData()
  }, [id, router, toast])

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return

    const stockValue = parseInt(newStock)
    if (isNaN(stockValue) || stockValue < 0) {
      toast({
        title: 'Error',
        description: 'Stock debe ser un número válido mayor o igual a 0',
        variant: 'destructive'
      })
      return
    }

    if (!reason.trim()) {
      toast({
        title: 'Error',
        description: 'Debe proporcionar una razón para el ajuste',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/admin/stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: product.id,
          newStock: stockValue,
          reason: reason.trim()
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to adjust stock')
      }

      toast({
        title: 'Éxito',
        description: 'Stock ajustado correctamente'
      })

      // Refresh data
      setProduct(prev => prev ? { ...prev, stock: stockValue } : null)
      setReason('')

      // Refresh logs
      const logsResponse = await fetch(`/api/admin/stock?productId=${id}`)
      if (logsResponse.ok) {
        const logsData: StockLog[] = await logsResponse.json()
        setStockLogs(logsData)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo ajustar el stock',
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
      <div className="text-center py-8">
        <p>Producto no encontrado</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href={`/admin/products/${id}/edit`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ajustar Stock</h1>
          <p className="text-muted-foreground">
            Gestiona el stock de: {product.name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ajuste Manual de Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Stock Actual</label>
                <div className="text-2xl font-bold text-blue-600">{product.stock}</div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Nuevo Stock *</label>
                <Input
                  type="number"
                  min="0"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  placeholder="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Razón del Ajuste *</label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej: Recepción de mercancía, Corrección de inventario..."
                  required
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Ajustando...' : 'Ajustar Stock'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial de Movimientos</CardTitle>
          </CardHeader>
          <CardContent>
            {stockLogs.length === 0 ? (
              <div className="text-center py-8">
                <History className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">No hay movimientos</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Los ajustes de stock aparecerán aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {stockLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{log.reason}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(log.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${log.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {log.change > 0 ? '+' : ''}{log.change}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {log.oldStock} → {log.newStock}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
