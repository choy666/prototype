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
    <div className="min-h-screen bg-background">
      <AdminNavbar />
      <main className="md:pl-72">
        <div className="py-4 px-4 sm:py-6 sm:px-6 md:py-8 md:px-8 lg:py-10 lg:px-10 xl:py-12 xl:px-12">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
