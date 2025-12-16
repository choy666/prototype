'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { FormattedAgency } from '@/types/agency';

type ShippingContext = {
  zipcode?: string | null;
  shipping_method_id?: string | null;
  shipping_method_name?: string | null;
  logistic_type?: string | null;
  deliver_to?: 'address' | 'agency' | null;
  carrier_id?: number | null;
  option_id?: number | null;
  option_hash?: string | null;
  state_id?: string | null;
};

type OrderPickupStatusResponse = {
  success: boolean;
  orderId: number;
  requiresPickupConfirmation: boolean;
  pickupConfirmed: boolean;
  shippingAgency: FormattedAgency | null;
  shippingContext: ShippingContext;
  mercadoLibreShipmentId: string | null;
};

type AgenciesResponse = {
  zipcode: string;
  agencies: FormattedAgency[];
  message?: string;
  requiresMlCheckout?: boolean;
  mercadoLibreStatus?: number;
};

export default function PickupConfirmationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  const orderId = searchParams.get('order_id');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickupStatus, setPickupStatus] = useState<OrderPickupStatusResponse | null>(null);
  const [agencies, setAgencies] = useState<FormattedAgency[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);

  const selectedAgency = useMemo(() => {
    if (!selectedAgencyId) return null;
    return agencies.find(a => a.id === selectedAgencyId) || null;
  }, [agencies, selectedAgencyId]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/pickup-confirmation');
      return;
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    if (!orderId) {
      setError('Falta order_id en la URL.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchPickupStatus() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/orders/${orderId}/pickup/status`);
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || 'No se pudo obtener el estado de retiro.');
        }

        const data = (await res.json()) as OrderPickupStatusResponse;
        if (cancelled) return;

        setPickupStatus(data);

        if (data.pickupConfirmed) {
          router.replace(`/dashboard?order_id=${orderId}&status=success`);
          return;
        }

        // Si no requiere confirmación, dejar continuar
        if (!data.requiresPickupConfirmation) {
          router.replace(`/dashboard?order_id=${orderId}&status=success`);
          return;
        }

        // Traer agencias usando el contexto guardado en la orden
        const ctx = data.shippingContext;
        const zipcode = ctx.zipcode ? String(ctx.zipcode) : '';

        const qs = new URLSearchParams();
        if (zipcode) qs.set('zipcode', zipcode);
        if (ctx.shipping_method_id) qs.set('shipping_method_id', String(ctx.shipping_method_id));
        if (ctx.logistic_type) qs.set('logistic_type', String(ctx.logistic_type));
        if (ctx.carrier_id != null) qs.set('carrier_id', String(ctx.carrier_id));
        if (ctx.option_id != null) qs.set('option_id', String(ctx.option_id));
        if (ctx.option_hash) qs.set('option_hash', String(ctx.option_hash));
        if (ctx.state_id) qs.set('state_id', String(ctx.state_id));

        const agenciesRes = await fetch(`/api/shipments/agencies?${qs.toString()}`);
        if (!agenciesRes.ok) {
          const text = await agenciesRes.text();
          throw new Error(`No se pudieron cargar sucursales: ${text}`);
        }

        const agenciesData = (await agenciesRes.json()) as AgenciesResponse;

        // Si la API no devuelve agencias, no hay nada para elegir.
        // En ese caso, dejamos al usuario seguir y mostramos un mensaje.
        if (!agenciesData.agencies || agenciesData.agencies.length === 0) {
          setAgencies([]);
          setError(agenciesData.message || 'Mercado Libre no devolvió sucursales para este envío.');
          return;
        }

        setAgencies(agenciesData.agencies);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPickupStatus();

    return () => {
      cancelled = true;
    };
  }, [status, orderId, router]);

  const handleConfirm = async () => {
    if (!orderId) return;
    if (!selectedAgency) {
      setError('Seleccioná una sucursal para continuar.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/pickup/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shippingAgency: selectedAgency }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo confirmar la sucursal.');
      }

      router.replace(`/dashboard?order_id=${orderId}&status=success`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg border p-6 w-full max-w-lg">
          <div className="flex items-center gap-2 text-gray-700">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Cargando sucursales para retiro...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-lg border p-6 w-full max-w-lg space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Confirmá tu punto de retiro</h1>
          <p className="text-sm text-gray-600">
            Para finalizar la compra, seleccioná la sucursal donde vas a retirar el pedido.
          </p>
        </div>

        {pickupStatus?.shippingContext?.zipcode && (
          <div className="text-xs text-gray-500">
            Código postal: <span className="font-mono">{pickupStatus.shippingContext.zipcode}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {agencies.length > 0 ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">Sucursales disponibles</div>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {agencies.map((agency) => (
                <label
                  key={agency.id}
                  className={`block p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedAgencyId === agency.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="pickup-agency"
                      className="mt-1"
                      checked={selectedAgencyId === agency.id}
                      onChange={() => setSelectedAgencyId(agency.id)}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{agency.name}</div>
                      <div className="text-xs text-gray-600">
                        {agency.address.street} {agency.address.number}, {agency.address.city}, {agency.address.state}
                      </div>
                      <div className="text-xs text-gray-500">CP: {agency.address.zipcode}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-900">
            No hay sucursales para seleccionar en este momento. Podés continuar y el punto se confirmará cuando Mercado Libre lo provea.
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => router.replace(`/dashboard?order_id=${orderId || ''}&status=success`)}
            disabled={saving}
          >
            Continuar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || agencies.length === 0}>
            {saving ? 'Guardando...' : 'Confirmar sucursal'}
          </Button>
        </div>
      </div>
    </div>
  );
}
