'use client'

import { ProductAttributes } from '@/components/admin/ProductAttributes'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default function ProductAttributesPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb items={[
        { label: 'Productos', href: '/admin/products' },
        { label: 'Atributos' }
      ]} />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Atributos de Productos</h1>
        <p className="text-muted-foreground">
          Gestiona los atributos personalizados para las variantes de productos
        </p>
      </div>

      <ProductAttributes />
    </div>
  )
}
