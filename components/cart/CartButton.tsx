// app/components/CartButton.tsx
'use client'

import { ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { useCartStore } from '@/lib/stores/useCartStore'

/**
 * 🛒 CartButton
 * - Muestra el ícono del carrito en la navbar o header
 * - Si hay productos en el carrito, renderiza un badge con la cantidad total
 * - Redirige a la página /cart al hacer click
 * - Incluye mejoras de accesibilidad y animación
 */
export function CartButton() {
  // Usamos el selector para obtener el total de ítems
  const totalItems = useCartStore((state) =>
    state.items.reduce((total, item) => total + item.quantity, 0)
  )

  return (
    <Link
      href="/cart"
      aria-label={`Carrito de compras (${totalItems} ${totalItems === 1 ? 'ítem' : 'ítems'})`}
      className="relative inline-block p-2 hover:bg-gray-100 rounded-full transition-colors"
    >
      {/* Ícono del carrito */}
      <ShoppingCart className="h-6 w-6" />

      {/* Badge con cantidad de ítems */}
      {totalItems > 0 && (
        <span
          className="
            absolute -top-1 -right-1 
            bg-primary text-white text-xs 
            rounded-full h-5 w-5 
            flex items-center justify-center
            transition-transform duration-200 ease-out
            hover:scale-110
            animate-bounce
          "
          aria-hidden="true"
        >
          {totalItems > 9 ? '9+' : totalItems}
        </span>
      )}
    </Link>
  )
}