'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Tag
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Productos', href: '/admin/products', icon: Package },
  { name: 'Categorías', href: '/admin/categories', icon: Tag },
  { name: 'Pedidos', href: '/admin/orders', icon: ShoppingCart },
  { name: 'Usuarios', href: '/admin/users', icon: Users },
  { name: 'Reportes', href: '/admin/reports', icon: BarChart3 },
  { name: 'Configuración', href: '/admin/settings', icon: Settings },
]

export function AdminNavbar() {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <>
      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black bg-opacity-25 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className={cn(
            "relative flex w-full max-w-xs flex-col bg-white dark:bg-gray-800 transition-transform duration-300 ease-in-out shadow-xl",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}>
            <div className="absolute right-0 top-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 min-h-[44px] min-w-[44px] shadow-lg"
                onClick={() => setSidebarOpen(false)}
                aria-label="Cerrar menú"
              >
                <X className="h-6 w-6 text-gray-900 dark:text-white" />
              </button>
            </div>
            <div className="flex flex-shrink-0 items-center px-4 py-6 border-b border-gray-200 dark:border-gray-700">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Panel Admin</h1>
            </div>
            <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto" role="navigation" aria-label="Navegación principal">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors min-h-[48px] w-full',
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-r-2 border-blue-500'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    )}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <item.icon className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                )
              })}
            </nav>
            <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => signOut()}
                className="group flex w-full items-center px-3 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors min-h-[48px]"
                aria-label="Cerrar sesión"
              >
                <LogOut className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-grow flex-col overflow-y-auto bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="flex flex-shrink-0 items-center px-4 py-6 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Panel Admin</h1>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors min-h-[48px] w-full',
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-r-2 border-blue-500'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.name}</span>
                </Link>
              )
            })}
          </nav>
          <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => signOut()}
              className="group flex w-full items-center px-3 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors min-h-[48px]"
              aria-label="Cerrar sesión"
            >
              <LogOut className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm lg:hidden">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-gray-700 lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menú de navegación"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Panel de Administración</h1>
        </div>
      </div>
    </>
  )
}
