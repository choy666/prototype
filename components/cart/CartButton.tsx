// app/components/CartButton.tsx
'use client'

import { ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { useCartStore, selectTotalItems } from '@/lib/stores/useCartStore'

/**
 * 🛒 CartButton
 * - Muestra el ícono del carrito en la navbar o header
 * - Si hay productos en el carrito, renderiza un badge con la cantidad total
 * - Redirige a la página /cart al hacer click
 * - Incluye mejoras de accesibilidad y animación
 */
export function CartButton() {
  // ✅ Usamos el selector centralizado para obtener el total de ítems
  const totalItems = useCartStore(selectTotalItems)

  return (
    <Link
      href="/cart"
      aria-label="Carrito de compras" // ♿ Mejora de accesibilidad
      className="relative"
    >
      {/* Ícono del carrito */}
      <ShoppingCart className="h-6 w-6" />

      {/* Badge con cantidad de ítems */}
      {totalItems > 0 && (
        <span
          className="
            absolute -top-2 -right-2 
            bg-primary text-white text-xs 
            rounded-full h-5 w-5 
            flex items-center justify-center
            transition-transform duration-200 ease-out
            hover:scale-110
            animate-bounce
          "
        >
          {totalItems}
        </span>
      )}
    </Link>
  )
}