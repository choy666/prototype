'use client'

import { useCartStore } from '@/lib/stores/useCartStore'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { Minus, Plus, X } from 'lucide-react'
import Image from 'next/image'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value)

export default function CartPage() {
  const { 
    items, 
    removeItem, 
    updateQuantity, 
    clearCart, 
  } = useCartStore()

  if (items.length === 0) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Tu carrito está vacío</h1>
        <p className="mb-6">¡Explora nuestros productos y encuentra algo que te guste!</p>
        <Link href="/products">
          <Button>Seguir comprando</Button>
        </Link>
      </div>
    )
  }

  // 👇 Ajustamos el cálculo del total para que use el precio con descuento
  const total = items.reduce((acc, item) => {
    const basePrice = item.price
    const finalPrice = item.discount && item.discount > 0
      ? basePrice * (1 - item.discount / 100)
      : basePrice
    return acc + finalPrice * item.quantity
  }, 0)

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Tu Carrito</h1>
        <Button variant="outline" onClick={clearCart}>
          Vaciar carrito
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-4">
          {items.map((item, index) => {
            const basePrice = item.price
            const hasDiscount = item.discount && item.discount > 0
            const finalPrice = hasDiscount
              ? basePrice * (1 - item.discount / 100)
              : basePrice

            return (
              <div 
                key={`${item.id}-${index}`} 
                className="flex flex-row items-center gap-4 p-4 border rounded-lg"
              >
                <Image
                  src={item.image || '/placeholder-product.jpg'}
                  alt={item.name}
                  width={80}
                  height={80}
                  loading="lazy"
                  className="w-20 h-20 object-cover rounded"
                />
                <div className="flex-1">
                  <h3 className="font-medium">{item.name}</h3>
                  {hasDiscount ? (
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-400 line-through">
                        {formatCurrency(basePrice)}
                      </span>
                      <span className="text-red-600 font-semibold">
                        {formatCurrency(finalPrice)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-gray-600">{formatCurrency(basePrice)}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Disminuir cantidad"
                    onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span aria-live="polite">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Aumentar cantidad"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="font-medium">
                  {formatCurrency(finalPrice * item.quantity)}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Eliminar producto"
                  onClick={() => removeItem(item.id)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            )
          })}
        </div>

        <div className="bg-gray-50 p-6 rounded-lg h-fit">
          <h2 className="text-xl font-bold mb-4">Resumen del pedido</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-gray-600">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Envío</span>
              <span className="text-gray-600">{formatCurrency(0)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-4">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <Button className="w-full mt-6 font-bold" size="lg">
              <Link rel="stylesheet" href="/checkout">
              Proceder al pago
              </Link>
            </Button>
            <div className="text-gray-600 text-center text-sm mt-4">
              <Link href="/products" className=" hover:underline">
                continuar comprando
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}