// lib/mercadopago/mercadopago.ts
import { MercadoPagoConfig, Preference } from 'mercadopago'

if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
  throw new Error('❌ MERCADO_PAGO_ACCESS_TOKEN no está definido en el entorno')
}

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
})

export async function createPreference(params: {
  items: { id: string; title: string; quantity: number; unit_price: number; currency_id?: string }[]
  payer: { name: string; surname: string; email: string }
  back_urls: { success: string; failure: string; pending: string }
  auto_return: string
  external_reference: string
}) {
  const preference = new Preference(mpClient)

  const response = await preference.create({
    body: {
      items: params.items.map(i => ({
        id: i.id,
        title: i.title,
        quantity: i.quantity,
        unit_price: i.unit_price,
        currency_id: i.currency_id ?? 'ARS',
      })),
      payer: params.payer,
      back_urls: params.back_urls,
      auto_return: params.auto_return,
      external_reference: params.external_reference,
    },
  })

  return {
    preferenceId: response.id,
    mpId: response.id,
  }
}
