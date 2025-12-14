'use client'

import { useState } from 'react'
import { AdminSidebar } from './AdminSidebar'
import Offcanvas from '@/components/ui/Offcanvas'
import { Button } from '@/components/ui/Button'
import { Menu } from 'lucide-react'

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Mobile sidebar */}
      <Offcanvas
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        title="Navegación"
      >
        <AdminSidebar isMobile onClose={() => setSidebarOpen(false)} />
      </Offcanvas>

      {/* Desktop sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64">
        <AdminSidebar />
      </div>

      {/* Main content */}
      <div className="md:pl-64">
        {/* Top bar for mobile */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-800 bg-gray-900 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1 items-center">
              <h1 className="text-lg font-semibold text-white">Panel Admin</h1>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
