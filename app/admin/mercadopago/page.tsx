import { auth } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import { MercadoPagoConnection } from '@/components/admin/MercadoPagoConnection';

export default async function MercadoPagoAdminPage() {
  const session = await auth();
  
  if (!session || session.user.role !== 'admin') {
    redirect('/api/auth/signin?callbackUrl=/admin/mercadopago');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Configuración de MercadoPago</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <MercadoPagoConnection />
      </div>
    </div>
  );
}
