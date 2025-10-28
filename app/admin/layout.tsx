import { auth } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import { AdminNavbar } from '@/components/admin/AdminNavbar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session || session.user.role !== 'admin') {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AdminNavbar />
      <main className="lg:pl-72">
        <div className="py-4 sm:py-6 lg:py-10">
          <div className="px-3 sm:px-4 lg:px-6 xl:px-8 max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
