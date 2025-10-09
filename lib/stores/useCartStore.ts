// lib/stores/useCartStore.ts
import { create } from 'zustand'
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware'

export interface CartItem {
  id: number
  name: string
  price: number
  image?: string
  quantity: number
  stock: number
}

interface CartState {
  items: CartItem[]
  error?: string | { type: 'adjusted' | 'outOfStock' | 'serverError'; message: string } | null
  addItem: (item: CartItem) => void
  removeItem: (id: number) => void
  updateQuantity: (id: number, newQuantity: number) => void
  clearCart: () => void
  totalPrice: () => number
  init: () => () => void
  clearError: () => void
  updateItemStock: (id: number, newStock: number) => void
}

const storage: StateStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(name);
    } catch (error) {
      console.error('Error accediendo al almacenamiento local:', error);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      console.error('Error guardando en almacenamiento local:', error);
      // Opcional: Podrías implementar un fallback a sessionStorage o memoria
    }
  },
  removeItem: (name: string): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(name);
    } catch (error) {
      console.error('Error eliminando del almacenamiento local:', error);
    }
  },
}

// Selector para obtener el total de ítems en el carrito
export const selectTotalItems = (state: CartState) => 
  state.items.reduce((total, item) => total + item.quantity, 0)

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      error: null,
      init: () => {
        let eventSource: EventSource | null = null

        try {
          eventSource = new EventSource('/api/auth/stock/stream')

          eventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)
              const { id, stock } = data
              
              if (id && typeof stock === 'number') {
                get().updateItemStock(id, stock)
              }
            } catch (error) {
              console.error('Error procesando actualización de stock:', error)
              set({
                error: {
                  type: 'serverError',
                  message: 'Error al actualizar el stock'
                }
              })
            }
          }

          eventSource.onerror = (error) => {
            console.error('Error en la conexión SSE:', error)
            eventSource?.close()
          }

          return () => {
            eventSource?.close()
          }
        } catch (error) {
          console.error('Error al inicializar conexión SSE:', error)
          return () => {}
        }
      },
      clearError: () => set({ error: null }),
      updateItemStock: (id, newStock) => 
        set(state => {
          const item = state.items.find(i => i.id === id)
          if (!item) return state

          const updatedItems = state.items.map(item => 
            item.id === id 
              ? { 
                  ...item, 
                  stock: newStock,
                  quantity: Math.min(item.quantity, newStock)
                } 
              : item
          )

          return {
            items: updatedItems,
            ...(item.quantity > newStock && {
              error: {
                type: 'adjusted',
                message: `Stock actualizado para ${item.name}, cantidad ajustada a ${Math.min(item.quantity, newStock)}`
              }
            })
          }
        }),
      addItem: (newItem) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === newItem.id)

          if (existing) {
            const newQty = existing.quantity + newItem.quantity

            if (newQty > existing.stock) {
              const adjustedQty = Math.min(newQty, existing.stock)
              const addedQty = adjustedQty - existing.quantity

              if (addedQty <= 0) {
                return {
                  ...state,
                  error: {
                    type: 'adjusted',
                    message: `Cantidad ajustada al stock disponible`,
                  },
                }
              }

              return {
                items: state.items.map((i) =>
                  i.id === newItem.id ? { ...i, quantity: adjustedQty } : i
                ),
                error: {
                  type: 'adjusted',
                  message: `Cantidad ajustada al stock disponible`,
                },
              }
            }

            return {
              items: [
                ...state.items,
                { ...newItem, quantity: Math.min(newItem.quantity, newItem.stock) },
              ],
            }
          }

          if (newItem.stock === 0) {
            return {
              ...state,
              error: {
                type: 'outOfStock',
                message: `Este producto no tiene stock disponible`,
              },
            }
          }

          return {
            items: [
              ...state.items,
              { ...newItem, quantity: Math.min(newItem.quantity, newItem.stock) },
            ],
          }
        }),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),
      updateQuantity: (id, newQuantity) =>
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id !== id) return item

            const quantity = Math.min(
              Math.max(1, newQuantity),
              item.stock
            )

            return { ...item, quantity }
          }),
        })),
      clearCart: () => set({ items: [] }),
      totalPrice: () =>
        get().items.reduce((acc, i) => acc + i.price * i.quantity, 0),
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ items: state.items }), // Solo persiste los items
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Aquí podrías hacer validaciones adicionales al hidratar
          console.log('Carrito hidratado', state.items.length, 'productos')
        }
      },
    }
  )
)