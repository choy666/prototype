'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  Tags,
  Truck,
  CreditCard,
  ShoppingBag,
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { signOut } from 'next-auth/react'

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Productos', href: '/admin/products', icon: Package },
  { name: 'Categorías', href: '/admin/categories', icon: Tags },
  { name: 'Pedidos', href: '/admin/orders', icon: ShoppingCart },
  { name: 'Envíos', href: '/admin/shipments', icon: Truck },
  { name: 'Métodos de Envío', href: '/admin/shipping-methods', icon: Truck },
  { name: 'MercadoLibre', href: '/admin/mercadolibre', icon: ShoppingBag },
  { name: 'MercadoPago', href: '/admin/mercadopago', icon: CreditCard },
  { name: 'Usuarios', href: '/admin/users', icon: Users },
  { name: 'Reportes', href: '/admin/reports', icon: BarChart3 },
  { name: 'Configuración', href: '/admin/business-settings', icon: Settings },
]

interface AdminSidebarProps {
  className?: string
  isMobile?: boolean
  onClose?: () => void
}

export function AdminSidebar({ className, isMobile = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname()

  return (
    <div className={cn(
      "flex flex-col h-full bg-gray-900 border-r border-gray-800",
      isMobile ? "w-full" : "w-64",
      className
    )}>
      {/* Logo/Brand */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-gray-800">
        <Link href="/admin" className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-white">Admin</span>
        </Link>
        {isMobile && onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={isMobile ? onClose : undefined}
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <button 
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span className="mr-2">←</span>
          Cerrar Sesión
        </button>
      </div>
    </div>
  )
}
