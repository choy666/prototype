'use client'

import { useEffect } from 'react'
import { useCartStore } from '@/lib/stores/useCartStore'
import { useToast } from '@/components/ui/use-toast'

export function CartProvider({ children }: { children: React.ReactNode }) {
  const init = useCartStore(state => state.init)
  const error = useCartStore(state => state.error)
  const clearError = useCartStore(state => state.clearError)
  const { toast } = useToast()

  useEffect(() => {
    // Inicializar la suscripción SSE
    const cleanup = init()

    // Limpiar al desmontar
    return () => {
      if (cleanup) cleanup()
    }
  }, [init])

  // Escuchar errores tipados del store y mostrarlos en un toast global
  useEffect(() => {
    if (!error) return

    let title = 'Aviso'
    let message: string
    let variant: 'default' | 'destructive' = 'default'

    if (typeof error === 'string') {
      // Handle string errors
      message = error
      variant = 'destructive'
    } else {
      // Handle error objects with type and message
      message = error.message
      
      switch (error.type) {
        case 'adjusted':
          title = 'Stock ajustado'
          variant = 'default'
          break
        case 'outOfStock':
          title = 'Producto agotado'
          variant = 'destructive'
          break
        case 'serverError':
          title = 'Error de servidor'
          variant = 'destructive'
          break
      }
    }

    toast({
      title,
      description: message,
      variant,
    })

    clearError()
  }, [error, clearError, toast])

  return <>{children}</>
}