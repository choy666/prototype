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
  Calendar,
  User,
  MapPin,
  CreditCard,
  ArrowLeft,
  Save
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { convertAttributesToObject } from '@/lib/utils'

interface OrderItem {
  id: string
  quantity: number
  price: number
  productId: number
  variantId?: number
  productName: string
  productImage?: string
  productAttributes?: Record<string, string>
  variantName?: string
  variantImage?: string[]
  variantAttributes?: Record<string, string>
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
  cancellationReason?: string
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Products */}
          <Card>
            <CardHeader>
              <CardTitle>Productos del Pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {order.items.map((item) => {
                  // Determinar la imagen a mostrar
                  const displayImage = item.variantId && item.variantImage && item.variantImage.length > 0
                    ? item.variantImage[0]
                    : item.productImage;

                  // Mostrar atributos relevantes: variante si existe, sino producto
                  const attrs = item.variantId ? convertAttributesToObject(item.variantAttributes) : convertAttributesToObject(item.productAttributes);
                  const attrsDisplay = Object.keys(attrs).length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1 mb-2">
                      {Object.entries(attrs).map(([key, value]) => (
                        <span key={`attr-${key}`} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                  ) : null;

                  return (
                    <div key={item.id} className="py-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                      <div className="sm:col-span-3 flex items-center space-x-4">
                        {displayImage ? (
                          <Image
                            src={displayImage}
                            alt={item.productName}
                            width={64}
                            height={64}
                            sizes="64px"
                            placeholder="blur"
                            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <Package className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-base">
                            {item.productName}{item.variantName ? ` - ${item.variantName}` : ''}
                          </h3>
                          {attrsDisplay}
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} x ${item.price.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-bold text-lg">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          {/* Management */}
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
              <Button onClick={handleSaveClick} disabled={saving} className="w-full sm:w-auto">
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </CardContent>
          </Card>

          {/* Cancellation Reason */}
          {order.status === 'cancelled' && order.cancellationReason && (
            <Card>
              <CardHeader>
                <CardTitle>Razón de Cancelación</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{order.cancellationReason}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Customer and Shipping Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div className="text-sm">
                  <p className="font-semibold">{order.userName}</p>
                  <p className="text-muted-foreground">{order.userEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm">{formatDate(order.createdAt)}</span>
              </div>
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm truncate">{order.paymentId || order.mercadoPagoId || 'N/A'}</span>
              </div>
              <div className="border-t my-3" />
              <div className="flex justify-between items-center text-sm">
                <span>Costo Envío:</span>
                <span className="font-medium">${order.shippingCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-lg">
                <span className="font-semibold">Total:</span>
                <span className="font-bold">${order.total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Dirección de Envío</CardTitle>
            </CardHeader>
            <CardContent>
              {order.shippingAddress ? (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold">{order.shippingAddress.nombre}</p>
                    <p>{order.shippingAddress.direccion}</p>
                    <p>{order.shippingAddress.ciudad}, {order.shippingAddress.provincia}</p>
                    <p>{order.shippingAddress.codigoPostal}</p>
                    <p>{order.shippingAddress.telefono}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Dirección no disponible</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
