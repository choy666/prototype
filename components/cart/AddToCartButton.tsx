'use client'

import { Button } from '@/components/ui/Button'
import { useCartStore } from '@/lib/stores/useCartStore'
import { useState, useEffect, useRef } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { addToCart } from '@/lib/actions/cart'
import { useSession } from 'next-auth/react'

type AddToCartButtonProps = {
  product: {
    id: number
    name: string
    price: number       // precio original
    discount: number   // 👈 soporta descuento
    image: string | null
    stock: number
    variantId?: number  // ID de la variante seleccionada
    variantAttributes?: Record<string, string> // atributos de la variante
    variantStock?: number // stock de la variante si aplica
    variantName?: string
    productAttributes?: Record<string, string> // atributos del producto base
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
  const { data: session } = useSession()

  const cartItem = cartItems.find(item =>
    item.id === product.id &&
    item.variantId === product.variantId
  )
  const currentQuantity = cartItem?.quantity ?? 0
  // Usar stock de variante si existe, sino stock del producto base
  const availableStock = product.variantId ? (product.variantStock ?? product.stock) : product.stock
  const isOutOfStock = availableStock <= 0
  const isMaxedOut = currentQuantity + quantity > availableStock

  const handleAddToCart = async () => {
    if (!product?.id || product.price <= 0 || isOutOfStock || isMaxedOut) {
      toast({
        title: 'Error',
        description: 'Producto inválido o sin stock',
        variant: 'destructive',
      })
      return
    }

    setIsAdding(true)

    try {
      // Agregar al store local inmediatamente para UI responsiva
      addItem({
        id: product.id,
        name: product.variantName || product.name,
        price: product.price,               // precio original
        discount: product.discount ?? 0,    // 👈 guardamos descuento
        image: product.image || undefined,
        quantity,
        stock: product.stock,
        variantId: product.variantId,       // 👈 guardamos variante
        variantAttributes: product.variantAttributes, // 👈 guardamos atributos de variante
        variantName: product.variantName,
        productAttributes: product.productAttributes, // 👈 guardamos atributos del producto
      })

      // Si el usuario está logueado, sincronizar con el servidor
      if (session?.user?.id) {
        try {
          await addToCart(Number(session.user.id), product.id, quantity, product.variantId)
        } catch (serverError) {
          console.error('Error sincronizando con servidor:', serverError)
          // No mostrar error al usuario ya que el producto ya se agregó al carrito local
        }
      }

      toast({
        title: 'Producto agregado',
        description: `${product.variantName || product.name} se agregó al carrito`,
      })
    } catch (error) {
      console.error('Error agregando al carrito:', error)
      toast({
        title: 'Error',
        description: 'No se pudo agregar el producto al carrito',
        variant: 'destructive',
      })
    } finally {
      timeoutRef.current = setTimeout(() => {
        setIsAdding(false)
      }, 1000)
    }
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
