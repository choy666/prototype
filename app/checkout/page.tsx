// app/checkout/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useCartStore } from '@/lib/stores/useCartStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getDiscountedPrice } from '@/lib/utils/pricing'
import { z } from 'zod'

// ✅ SDK de Mercado Pago
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react'

// ✅ Reutilizamos el esquema base
import { ShippingFormSchema } from '@/lib/mercadopago/validationsMP'

const ExtendedShippingSchema = ShippingFormSchema.extend({
  phone: z.string().min(6, 'Teléfono demasiado corto'),
  state: z.string().min(2, 'Provincia inválida'),
  postalCode: z.string().min(3, 'Código postal inválido'),
})

type ShippingForm = z.infer<typeof ExtendedShippingSchema>

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value)

type FieldConfig = {
  id: keyof ShippingForm
  label: string
  type?: string
}

const fields: FieldConfig[] = [
  { id: 'firstName', label: 'Nombre' },
  { id: 'lastName', label: 'Apellido' },
  { id: 'email', label: 'Email', type: 'email' },
  { id: 'phone', label: 'Teléfono' },
  { id: 'address', label: 'Dirección' },
  { id: 'city', label: 'Ciudad' },
  { id: 'state', label: 'Provincia' },
  { id: 'postalCode', label: 'Código Postal' },
  { id: 'country', label: 'País' },
]

export default function CheckoutPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { items, totalPrice, clearCart } = useCartStore()

  const [shippingForm, setShippingForm] = useState<ShippingForm>({
    firstName: session?.user?.name?.split(' ')[0] || '',
    lastName: session?.user?.name?.split(' ').slice(1).join(' ') || '',
    email: session?.user?.email || '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Argentina',
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingForm, string>>>({})
  const [preferenceId, setPreferenceId] = useState<string | null>(null)

  // ✅ Inicializamos Mercado Pago con la PUBLIC KEY
  useEffect(() => {
    initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!, { locale: 'es-AR' })
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setShippingForm(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)

    const parsed = ExtendedShippingSchema.safeParse(shippingForm)
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof ShippingForm, string>> = {}
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof ShippingForm
        fieldErrors[field] = issue.message
      })
      setErrors(fieldErrors)
      setIsProcessing(false)
      return
    }

    try {
      // ✅ Pedimos al backend que cree la preferencia
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          shippingAddress: {
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            email: parsed.data.email,
            address: parsed.data.address,
            city: parsed.data.city,
            postalCode: parsed.data.postalCode,
            country: parsed.data.country,
          },
          total: totalPrice(),
        }),
      })

      if (!response.ok) throw new Error('Error al crear preferencia')

      const { preferenceId } = await response.json()
      setPreferenceId(preferenceId) // 👈 Guardamos el ID para renderizar el Wallet
      clearCart()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al procesar el pedido. Inténtalo de nuevo.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!session) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Debes iniciar sesión</h1>
        <p className="mb-6">Para continuar con tu compra, necesitas estar autenticado.</p>
        <Link href="/login">
          <Button>Iniciar Sesión</Button>
        </Link>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Tu carrito está vacío</h1>
        <p className="mb-6">Agrega productos antes de proceder al pago.</p>
        <Link href="/products">
          <Button>Ver Productos</Button>
        </Link>
      </div>
    )
  }

  const total = totalPrice()

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-6">
        <Link href="/cart" className="flex items-center text-blue-600 hover:underline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver al carrito
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Formulario de envío */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Información de Envío</h2>
          <form id="checkout-form" onSubmit={handleSubmit} className="space-y-4">
            {fields.map(({ id, label, type }) => (
              <div key={id}>
                <Label htmlFor={id}>{label}</Label>
                <Input
                  id={id}
                  name={id}
                  type={type || 'text'}
                  value={shippingForm[id]}
                  onChange={handleInputChange}
                  required
                  aria-invalid={!!errors[id]}
                />
                {errors[id] && (
                  <p className="text-sm text-red-600 mt-1">{errors[id]}</p>
                )}
              </div>
            ))}
            <Button
              type="submit"
              className="w-full mt-6"
              disabled={isProcessing}
              aria-busy={isProcessing}
            >
              {isProcessing ? 'Procesando...' : 'Generar pago'}
            </Button>
          </form>
        </div>

        {/* Resumen del pedido + Mercado Pago */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Resumen del Pedido</h2>
          <div className="bg-gray-50 p-6 rounded-lg">
            <div className="space-y-4 mb-6">
              {items.map((item) => {
                const finalPrice = getDiscountedPrice(item)
                return (
                  <div key={item.id} className="flex justify-between">
                    <span>{item.name} x{item.quantity}</span>
                    <span>{formatCurrency(finalPrice * item.quantity)}</span>
                  </div>
                )
              })}
            </div>
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Envío</span>
                <span>{formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* 👇 Renderizamos el Wallet solo si ya tenemos preferenceId */}
            {preferenceId && (
              <div className="mt-6">
                <Wallet initialization={{ preferenceId }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}