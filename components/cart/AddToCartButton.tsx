'use client'

import { Button } from '@/components/ui/Button'
import { useCartStore } from '@/lib/stores/useCartStore'
import { useState, useEffect, useRef } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

type AddToCartButtonProps = {
  product: {
    id: number
    name: string
    price: number       // precio original
    discount: number   // 👈 soporta descuento
    image: string | null
    stock: number
    variantId?: number  // ID de la variante seleccionada
  }
  quantity?: number
  className?: string
}

export function AddToCartButton({
  product,
  quantity = 1,
  className,
}: AddToCartButtonProps) {
  const [isAdding, setIsAdding] = useState(false)
  const addItem = useCartStore(state => state.addItem)
  const cartItems = useCartStore(state => state.items)
  const error = useCartStore(state => state.error)
  const { toast } = useToast()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cartItem = cartItems.find(item => item.id === product.id)
  const currentQuantity = cartItem?.quantity ?? 0
  const isOutOfStock = product.stock <= 0
  const isMaxedOut = currentQuantity + quantity > product.stock

  const handleAddToCart = () => {
    if (!product?.id || product.price <= 0 || isOutOfStock || isMaxedOut) {
      toast({
        title: 'Error',
        description: 'Producto inválido o sin stock',
        variant: 'destructive',
      })
      return
    }

    setIsAdding(true)

    addItem({
      id: product.id,
      name: product.name,
      price: product.price,               // precio original
      discount: product.discount ?? 0,    // 👈 guardamos descuento
      image: product.image || undefined,
      quantity,
      stock: product.stock,
      variantId: product.variantId,       // 👈 guardamos variante
    })

    timeoutRef.current = setTimeout(() => {
      setIsAdding(false)
    }, 1000)
  }

  // Manejo de errores del store
  useEffect(() => {
    if (error) {
      const errorMessage =
        typeof error === 'string' ? error : error?.message || 'Error desconocido'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      useCartStore.getState().clearError()
    }
  }, [error, toast])

  // Limpieza del timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <Button
      onClick={handleAddToCart}
      disabled={isAdding || isOutOfStock || isMaxedOut}
      className={className ?? ''}
      aria-label="Añadir al carrito"
    >
      <span aria-live="polite" className="flex items-center gap-2">
        <ShoppingCart
          className={`h-4 w-4 ${isAdding ? 'text-green-500 animate-pulse' : ''}`}
          aria-hidden="true"
        />
        {isAdding ? (
          <span>Producto añadido al carrito</span>
        ) : (
          <span>{isOutOfStock ? 'Sin stock' : 'Agregar al carrito'}</span>
        )}
      </span>
    </Button>
  )
}