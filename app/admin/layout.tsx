import { auth } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import { AdminLayout } from '@/components/admin/AdminLayout'

export default async function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session || session.user.role !== 'admin') {
    redirect('/')
  }

  return (
    <AdminLayout>
      {children}
    </AdminLayout>
  )
}
