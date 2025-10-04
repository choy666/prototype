'use client'

import { Button } from '@/components/ui/Button'
import { useCartStore } from '@/lib/stores/useCartStore'
import { useState, useEffect, useRef } from 'react'
import { ShoppingCart } from 'lucide-react'

type AddToCartButtonProps = {
  product: {
    id: string | number
    name: string
    price: number
    image: string | null
    stock: number
  }
  quantity?: number
  className?: string
}

export function AddToCartButton({
  product,
  quantity = 1,
  className
}: AddToCartButtonProps) {
  const [isAdding, setIsAdding] = useState(false)
  const addItem = useCartStore(state => state.addItem)
  const cartItems = useCartStore(state => state.items)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cartItem = cartItems.find(item => item.id === product.id)
  const currentQuantity = cartItem?.quantity ?? 0
  const isOutOfStock = product.stock <= 0
  const isMaxedOut = currentQuantity + quantity > product.stock

  const handleAddToCart = () => {
    if (!product?.id || product.price <= 0 || isOutOfStock || isMaxedOut) {
      console.error('Producto inválido o sin stock, no se puede agregar al carrito:', product)
      return
    }

    setIsAdding(true)

    addItem({
      id: String(product.id),
      name: product.name,
      price: product.price,
      image: product.image || undefined,
      quantity
    })

    timeoutRef.current = setTimeout(() => {
      setIsAdding(false)
    }, 1000)
  }

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