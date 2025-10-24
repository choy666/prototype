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
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar />
      <main className="lg:pl-72">
        <div className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
