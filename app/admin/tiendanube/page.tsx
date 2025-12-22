import { auth } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import { TiendanubeConnection } from '@/components/admin/TiendanubeConnection';

export default async function TiendanubeAdminPage() {
  const session = await auth();

  if (!session || session.user.role !== 'admin') {
    redirect('/api/auth/signin?callbackUrl=/admin/tiendanube');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Configuración de Tiendanube</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <TiendanubeConnection />
      </div>
    </div>
  );
}
