'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import {
  Package,
  DollarSign,
  Calendar,
  User,
  MapPin,
  Truck,
  CreditCard,
  ArrowLeft,
  Save
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface OrderItem {
  id: string
  quantity: number
  price: number
  productId: number
  productName: string
  productImage?: string
}

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
  items: OrderItem[]
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

export default function AdminOrderDetailPage() {
  const params = useParams()
  const orderId = params.id as string
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<{ status: string; trackingNumber: string } | null>(null)
  const { toast } = useToast()

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/orders/${orderId}`)
      if (!response.ok) throw new Error('Failed to fetch order')
      const data = await response.json()
      setOrder(data)
      setStatus(data.status)
      setTrackingNumber(data.trackingNumber || '')
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el pedido',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [orderId, toast])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  const handleSaveClick = () => {
    const changes = {
      status,
      trackingNumber,
    }
    setPendingChanges(changes)
    setShowConfirmation(true)
  }

  const handleConfirmSave = async () => {
    if (!pendingChanges) return

    try {
      setSaving(true)
      setShowConfirmation(false)
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: pendingChanges.status,
          trackingNumber: pendingChanges.trackingNumber || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || 'Failed to update order')
      }

      toast({
        title: 'Éxito',
        description: 'Pedido actualizado correctamente'
      })

      // Refresh order data
      fetchOrder()
      setPendingChanges(null)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo actualizar el pedido',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCancelSave = () => {
    setShowConfirmation(false)
    setPendingChanges(null)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-8">
        <Package className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">Pedido no encontrado</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          El pedido que buscas no existe o ha sido eliminado.
        </p>
        <Link href="/admin/orders">
          <Button className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Pedidos
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/orders">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pedido #{order.id}</h1>
            <p className="text-muted-foreground">
              Detalles del pedido y gestión
            </p>
          </div>
        </div>
        <Badge className={statusColors[order.status]}>
          {statusLabels[order.status]}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Información del Pedido */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <strong>Cliente:</strong> {order.userName} ({order.userEmail})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <strong>Fecha:</strong> {formatDate(order.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <strong>ID de Pago:</strong> {order.paymentId || order.mercadoPagoId || 'N/A'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <strong>Total:</strong> ${order.total.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <strong>Envío:</strong> ${order.shippingCost.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Dirección de Envío */}
        <Card>
          <CardHeader>
            <CardTitle>Dirección de Envío</CardTitle>
          </CardHeader>
          <CardContent>
            {order.shippingAddress ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="text-sm">
                    <p><strong>{order.shippingAddress.nombre}</strong></p>
                    <p>{order.shippingAddress.direccion}</p>
                    <p>{order.shippingAddress.ciudad}, {order.shippingAddress.provincia}</p>
                    <p>{order.shippingAddress.codigoPostal}</p>
                    <p>{order.shippingAddress.telefono}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Dirección no disponible</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gestión del Pedido */}
      <Card>
        <CardHeader>
          <CardTitle>Gestión del Pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Estado del Pedido</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Número de Seguimiento</label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Ingresa el número de seguimiento"
              />
            </div>
          </div>
          <Button onClick={handleSaveClick} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </CardContent>
      </Card>

      {/* Productos del Pedido */}
      <Card>
        <CardHeader>
          <CardTitle>Productos del Pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  {item.productImage ? (
                    <Image
                      src={item.productImage}
                      alt={item.productName}
                      width={48}
                      height={48}
                      sizes="48px"
                      placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-gray-200 flex items-center justify-center">
                      <Package className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium">{item.productName}</h3>
                    <p className="text-sm text-muted-foreground">
                      Cantidad: {item.quantity}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    <DollarSign className="inline h-4 w-4" />
                    {(item.price * item.quantity).toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ${item.price.toFixed(2)} c/u
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmation}
        title="Confirmar Cambios"
        description={`¿Estás seguro de que deseas guardar los siguientes cambios en el pedido #${order.id}?`}
        confirmText="Guardar Cambios"
        cancelText="Cancelar"
        onConfirm={handleConfirmSave}
        onCancel={handleCancelSave}
      />
    </div>
  )
}
