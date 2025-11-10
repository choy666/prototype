'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/card';
import { Address } from '@/lib/schema';
import { toast } from 'react-hot-toast';
import { MapPin, Edit, Trash2, Star, Plus } from 'lucide-react';

interface AddressSelectorProps {
  onAddressSelect: (address: Address | null) => void;
  onNewAddress: () => void;
  selectedAddressId?: number;
}

export function AddressSelector({
  onAddressSelect,
  onNewAddress,
  selectedAddressId
}: AddressSelectorProps) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingDefault, setSettingDefault] = useState<number | null>(null);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const response = await fetch('/api/addresses');
      if (response.ok) {
        const data = await response.json();
        setAddresses(data);
      } else {
        toast.error('Error al cargar direcciones');
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
      toast.error('Error al cargar direcciones');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (addressId: number) => {
    setSettingDefault(addressId);
    try {
      const response = await fetch(`/api/addresses/${addressId}/default`, {
        method: 'PUT',
      });

      if (response.ok) {
        await fetchAddresses(); // Recargar direcciones
        toast.success('Dirección predeterminada actualizada');
      } else {
        toast.error('Error al actualizar dirección predeterminada');
      }
    } catch (error) {
      console.error('Error setting default address:', error);
      toast.error('Error al actualizar dirección predeterminada');
    } finally {
      setSettingDefault(null);
    }
  };

  const handleDelete = async (addressId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta dirección?')) {
      return;
    }

    try {
      const response = await fetch(`/api/addresses/${addressId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAddresses(prev => prev.filter(addr => addr.id !== addressId));
        toast.success('Dirección eliminada');
        // Si la dirección eliminada estaba seleccionada, deseleccionar
        if (selectedAddressId === addressId) {
          onAddressSelect(null);
        }
      } else {
        toast.error('Error al eliminar dirección');
      }
    } catch (error) {
      console.error('Error deleting address:', error);
      toast.error('Error al eliminar dirección');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Seleccionar Dirección de Envío</h3>
        <Button
          onClick={onNewAddress}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nueva Dirección
        </Button>
      </div>

      {addresses.length === 0 ? (
        <Card className="p-6 text-center">
          <MapPin className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h4 className="font-medium mb-2">No tienes direcciones guardadas</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Agrega una dirección para agilizar tus futuras compras
          </p>
          <Button onClick={onNewAddress} className="w-full">
            Agregar Primera Dirección
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <Card
              key={address.id}
              className={`p-4 cursor-pointer transition-all ${
                selectedAddressId === address.id
                  ? 'ring-2 ring-blue-500 bg-gray-900'
                  : 'hover:shadow-md'
              }`}
              onClick={() => onAddressSelect(address)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">{address.nombre}</span>
                    {address.isDefault && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                        <Star className="h-3 w-3" />
                        Predeterminada
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{address.direccion}</p>
                    <p>{address.ciudad}, {address.provincia} - CP: {address.codigoPostal}</p>
                    <p>Tel: {address.telefono}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {!address.isDefault && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(address.id);
                      }}
                      variant="ghost"
                      size="sm"
                      disabled={settingDefault === address.id}
                      className="h-8 w-8 p-0"
                      title="Marcar como predeterminada"
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}

                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Implementar edición
                      toast('Función de edición próximamente');
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Editar dirección"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>

                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(address.id);
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Eliminar dirección"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {addresses.length > 0 && (
        <Card
          className="p-4 cursor-pointer border-dashed hover:bg-gray-50 transition-colors"
          onClick={() => onAddressSelect(null)}
        >
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Plus className="h-4 w-4" />
            <span>Usar una dirección diferente</span>
          </div>
        </Card>
      )}
    </div>
  );
}
