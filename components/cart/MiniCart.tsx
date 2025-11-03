// app/components/MiniCart.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { X, ShoppingCart, Plus, Minus } from 'lucide-react'
import { useCartStore } from '@/lib/stores/useCartStore'
import { Button } from '../ui/Button'
import Link from 'next/link'
import Image from 'next/image'

/**
 * 🛒 MiniCart
 * - Botón de carrito con badge de cantidad
 * - Al hacer click despliega un panel flotante con los ítems
 * - Permite eliminar productos, modificar cantidades y ver el total
 * - Incluye mejoras de accesibilidad, animación y UX
 */
export function MiniCart() {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // ✅ Obtenemos estado y acciones del store
  const { items, removeItem, updateQuantity, totalPrice } = useCartStore()

  // 📊 Total de ítems (derivado del store)
  const totalItems = items.reduce((total, item) => total + item.quantity, 0)

  // ♿ Control de foco: al abrir, mover foco al panel
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus()
    }
  }, [isOpen])

  // 🔒 Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative">
      {/* Botón principal del carrito */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Abrir carrito de compras" // ♿ accesibilidad
        className="relative"
      >
        <ShoppingCart className="h-6 w-6" />
        {totalItems > 0 && (
          <span
            className="
              absolute -top-2 -right-2 
              bg-primary text-white text-xs 
              rounded-full h-5 w-5 
              flex items-center justify-center
              transition-transform duration-200 ease-out
              transform hover:scale-110 // ✨ animación en el badge
            "
          >
            {totalItems}
          </span>
        )}
      </button>

      {/* Panel desplegable del carrito */}
      {isOpen && (
        <div
          ref={panelRef}
          tabIndex={-1} // necesario para poder enfocar el panel
          className="
            absolute right-0 mt-2 w-80 
            bg-white rounded-lg shadow-lg z-50 p-4
            animate-in slide-in-from-top-2 // ✨ animación de entrada
          "
          role="dialog"
          aria-label="Mini carrito"
        >
          {/* Header del panel */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">Tu Carrito</h3>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar carrito" // ♿ accesibilidad
              className="hover:scale-110 transition-transform"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Lista de productos */}
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-gray-500">Tu carrito está vacío</p>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 hover:bg-gray-50 p-2 rounded-md transition"
                  >
                    <Image
                      src={item.image || '/placeholder-product.jpg'}
                      alt={`Imagen del producto ${item.name} en el carrito`}
                      width={64}
                      height={64}
                      sizes="64px"
                      placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+IRjWjBqO6O2mhP//Z"
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium">{item.name}</h4>
                      {item.variantAttributes && Object.keys(item.variantAttributes).length > 0 && (
                        <p className="text-xs text-gray-500">
                          {Object.entries(item.variantAttributes).map(([key, value]) => `${key}: ${value}`).join(', ')}
                        </p>
                      )}
                      <p className="text-sm text-gray-600">
                        ${item.price} x {item.quantity}
                      </p>

                      {/* Botones de cantidad */}
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1, item.variantId)}
                          aria-label={`Disminuir cantidad de ${item.name}`}
                          className="p-2 rounded bg-gray-200 hover:bg-gray-300 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="px-2">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1, item.variantId)}
                          aria-label={`Aumentar cantidad de ${item.name}`}
                          className="p-2 rounded bg-gray-200 hover:bg-gray-300 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Botón eliminar */}
                    <button
                      onClick={() => removeItem(item.id, item.variantId)}
                      aria-label={`Eliminar ${item.name} del carrito`} // ♿ accesibilidad
                      className="text-red-500 hover:scale-110 transition-transform"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer con total y CTA */}
          {items.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <div className="flex justify-between font-bold mb-4">
                <span>Total:</span>
                <span>${totalPrice()}</span>
              </div>
              <Link href="/cart" className="block w-full">
                <Button className="w-full">Ver carrito</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}