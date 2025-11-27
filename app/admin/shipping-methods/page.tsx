'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';

interface ShippingMethod {
  id: number;
  name: string;
  baseCost: string;
  freeThreshold: string | null;
  isActive: boolean;
}

export default function AdminShippingMethodsPage() {
  const { data: session, status } = useSession();
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchMethods = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/shipping-methods');
        if (!res.ok) {
          throw new Error('Error al cargar métodos de envío');
        }
        const data = await res.json();
        setMethods(data);
      } catch (error) {
        console.error(error);
        toast.error('No se pudieron cargar los métodos de envío');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMethods();
  }, []);

  function handleChange<K extends keyof ShippingMethod>(
    id: number,
    field: K,
    value: ShippingMethod[K]
  ) {
    setMethods(prev =>
      prev.map(m => (m.id === id ? { ...m, [field]: value } : m))
    );
  }

  const handleSave = async (method: ShippingMethod) => {
    try {
      const res = await fetch('/api/shipping-methods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: method.id,
          name: method.name,
          baseCost: Number(method.baseCost),
          freeThreshold:
            method.freeThreshold === null || method.freeThreshold === ''
              ? null
              : Number(method.freeThreshold),
          isActive: method.isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al guardar cambios');
      }

      toast.success('Método de envío actualizado');
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : 'Error al guardar cambios'
      );
    }
  };

  if (status === 'loading') {
    return <div className="p-4">Cargando sesión...</div>;
  }

  if (!session || session.user?.role !== 'admin') {
    return <div className="p-4">No autorizado</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Métodos de envío</h1>
      {isLoading ? (
        <div>Cargando métodos de envío...</div>
      ) : (
        <div className="space-y-4">
          {methods.map(method => (
            <div
              key={method.id}
              className="border rounded-lg p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex-1 space-y-2">
                <div>
                  <label className="block text-xs text-gray-500">Nombre</label>
                  <input
                    className="border rounded px-2 py-1 w-full"
                    value={method.name}
                    onChange={e => handleChange(method.id, 'name', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500">Costo base (ARS)</label>
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-full"
                      value={method.baseCost}
                      onChange={e =>
                        handleChange(method.id, 'baseCost', e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">
                      Umbral envío gratis (ARS)
                    </label>
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-full"
                      value={method.freeThreshold ?? ''}
                      onChange={e =>
                        handleChange(method.id, 'freeThreshold', e.target.value)
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-4 sm:mt-6">
                    <input
                      id={`active-${method.id}`}
                      type="checkbox"
                      checked={method.isActive}
                      onChange={e =>
                        handleChange(method.id, 'isActive', e.target.checked)
                      }
                    />
                    <label
                      htmlFor={`active-${method.id}`}
                      className="text-sm text-gray-700"
                    >
                      Activo
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-3 md:mt-0 md:ml-4">
                <button
                  className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
                  onClick={() => handleSave(method)}
                >
                  Guardar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
