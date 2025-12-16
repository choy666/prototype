import { auth } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import { MercadoLibreConnection } from '@/components/admin/MercadoLibreConnection';
import { MercadoLibreWebhooksPanel } from '@/components/admin/MercadoLibreWebhooksPanel';

export default async function MercadoLibreAdminPage() {
  const session = await auth();
  
  if (!session || session.user.role !== 'admin') {
    redirect('/api/auth/signin?callbackUrl=/admin/mercadolibre');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Configuración de MercadoLibre</h1>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <MercadoLibreConnection />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <MercadoLibreWebhooksPanel />
        </div>
      </div>
    </div>
  );
}
