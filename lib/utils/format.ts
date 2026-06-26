// lib/utils/format.ts
export function formatCurrency(value: number, locale = 'es-AR', currency = 'ARS') {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(value)
  }