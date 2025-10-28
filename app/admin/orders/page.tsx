'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import {
  Search,
  Eye,
  Package,
  DollarSign,
  Calendar,
  User
} from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

interface Order {
  id: number
  userId: number
  total: number
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'rejected'
  paymentId?: string
  mercadoPagoId?: string
  shippingAddress?: {
    nombre: string
    direccion: string
    ciudad: string
    provincia: string
    codigoPostal: string
    telefono: string
  }
  shippingMethodId?: number
  shippingCost: number
  trackingNumber?: string
  createdAt: string
  updatedAt: string
  userEmail: string
  userName: string
  itemCount: number
}

interface ApiResponse {
  data: Order[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

const statusLabels = {
  pending: 'Pendiente',
  paid: 'Pagado',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  rejected: 'Rechazado',
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<ApiResponse['pagination'] | null>(null)
  const { toast } = useToast()

  const fetchOrders = useCallback(async (searchTerm = '', status = '', pageNum = 1) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '10',
        ...(searchTerm && { search: searchTerm }),
        ...(status && { status }),
      })
      const response = await fetch(`/api/admin/orders?${params}`)
      if (!response.ok) throw new Error('Failed to fetch orders')
      const data: ApiResponse = await response.json()
      setOrders(data.data)
      setPagination(data.pagination)
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los pedidos',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchOrders(search, statusFilter, 1)
    setPage(1)
  }

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
    fetchOrders(search, status, 1)
    setPage(1)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gestiona todos los pedidos de tu tienda
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar y Filtrar Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por email del usuario..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto min-h-[44px]">
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </Button>
          </form>

          <div className="flex gap-2 flex-wrap">
            <Button
              variant={statusFilter === '' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusFilter('')}
              className="min-h-[44px]"
            >
              Todos
            </Button>
            {Object.entries(statusLabels).map(([key, label]) => (
              <Button
                key={key}
                variant={statusFilter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusFilter(key)}
                className="min-h-[44px]"
              >
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Pedidos</CardTitle>
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
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No hay pedidos</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Los pedidos aparecerán aquí cuando los clientes realicen compras.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg space-y-4 sm:space-y-0 gap-4">
                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                    <div className="h-12 w-12 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <Package className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm sm:text-base">Pedido #{order.id}</h3>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                        <span className="flex items-center gap-1 truncate">
                          <User className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{order.userName} ({order.userEmail})</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 flex-shrink-0" />
                          {formatDate(order.createdAt)}
                        </span>
                        <span className="whitespace-nowrap">{order.itemCount} producto{order.itemCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 flex-shrink-0">
                    <div className="text-left sm:text-right">
                      <p className="font-medium text-sm sm:text-base">
                        <DollarSign className="inline h-4 w-4" />
                        {order.total.toFixed(2)}
                      </p>
                      <Badge className={`${statusColors[order.status]} text-xs`}>
                        {statusLabels[order.status]}
                      </Badge>
                    </div>
                    <Link href={`/admin/orders/${order.id}`}>
                      <Button variant="outline" size="sm" className="min-h-[44px] whitespace-nowrap" aria-label={`Ver detalles del pedido ${order.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalles
                      </Button>
                    </Link>
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
                  fetchOrders(search, statusFilter, page - 1)
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
                  fetchOrders(search, statusFilter, page + 1)
                }}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Siguiente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
