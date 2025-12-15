'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/card';
import { Address } from '@/lib/schema';
import { toast } from 'react-hot-toast';
import { 
  MapPin, 
  Edit, 
  Trash2, 
  Star, 
  Plus, 
  ArrowLeft,
  CheckCircle
} from 'lucide-react';
import { AddressForm } from '@/components/checkout/AddressForm';
import { formatAddressForMercadoLibre } from '@/lib/utils/address-formatter';

export default function AddressesPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [settingDefault, setSettingDefault] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

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
        await fetchAddresses();
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

    setDeleting(addressId);
    try {
      const response = await fetch(`/api/addresses/${addressId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAddresses(prev => prev.filter(addr => addr.id !== addressId));
        toast.success('Dirección eliminada');
      } else {
        toast.error('Error al eliminar dirección');
      }
    } catch (error) {
      console.error('Error deleting address:', error);
      toast.error('Error al eliminar dirección');
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setShowForm(true);
  };

  const handleFormSubmit = async (data: Omit<Address, 'id' | 'userId' | 'isDefault' | 'createdAt' | 'updatedAt'>) => {
    try {
      const url = editingAddress 
        ? `/api/addresses/${editingAddress.id}`
        : '/api/addresses';
      
      const method = editingAddress ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast.success(editingAddress ? 'Dirección actualizada' : 'Dirección agregada');
        setShowForm(false);
        setEditingAddress(null);
        await fetchAddresses();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Error al guardar dirección');
      }
    } catch (error) {
      console.error('Error saving address:', error);
      toast.error('Error al guardar dirección');
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingAddress(null);
  };

  if (showForm) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={handleFormCancel}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a mis direcciones
          </Button>
          <h1 className="text-2xl font-bold">
            {editingAddress ? 'Editar Dirección' : 'Nueva Dirección'}
          </h1>
          <p className="text-muted-foreground">
            Completa los datos correctamente para evitar errores en el envío
          </p>
        </div>

        <AddressForm
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          initialData={editingAddress || undefined}
          submitLabel={editingAddress ? 'Actualizar Dirección' : 'Guardar Dirección'}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Mis Direcciones</h1>
        <p className="text-muted-foreground">
          Administra tus direcciones de envío para agilizar tus compras
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <Card className="p-12 text-center">
          <MapPin className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No tienes direcciones guardadas</h2>
          <p className="text-muted-foreground mb-6">
            Agrega una dirección para agilizar tus futuras compras
          </p>
          <Button onClick={() => setShowForm(true)} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Agregar mi primera dirección
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {addresses.length} {addresses.length === 1 ? 'dirección' : 'direcciones'} guardadas
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Dirección
            </Button>
          </div>

          {addresses.map((address) => {
            // Formatear dirección para mostrar compatibilidad con ML
            const formatted = formatAddressForMercadoLibre(address);
            const isMLCompatible = formatted.original_address.formatted_state_id !== address.provincia;
            
            return (
              <Card key={address.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-5 w-5 text-gray-500" />
                      <span className="font-semibold text-lg">{address.nombre}</span>
                      {address.isDefault && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">
                          <Star className="h-3 w-3" />
                          Predeterminada
                        </span>
                      )}
                      {isMLCompatible && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full">
                          <CheckCircle className="h-3 w-3" />
                          Compatible con Mercado Libre
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm mb-4">
                      <p className="font-medium">{address.direccion} {address.numero}</p>
                      <p className="text-muted-foreground">
                        {address.ciudad}, {address.provincia} - CP: {address.codigoPostal}
                      </p>
                      <p className="text-muted-foreground">Teléfono: {address.telefono}</p>
                    </div>

                    {/* Mostrar formulario ML si es compatible */}
                    {isMLCompatible && (
                      <details className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                        <summary className="cursor-pointer hover:text-gray-700 font-medium">
                          Formato para Mercado Libre
                        </summary>
                        <div className="mt-2 space-y-1 font-mono">
                          <p>Calle: {formatted.street_name}</p>
                          <p>Número: {formatted.street_number}</p>
                          <p>CP: {formatted.zip_code}</p>
                          <p>Provincia: {formatted.state_id}</p>
                        </div>
                      </details>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {!address.isDefault && (
                      <Button
                        onClick={() => handleSetDefault(address.id)}
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
                      onClick={() => handleEdit(address)}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="Editar dirección"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>

                    <Button
                      onClick={() => handleDelete(address.id)}
                      variant="ghost"
                      size="sm"
                      disabled={deleting === address.id}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Eliminar dirección"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Botón para ir al checkout */}
      <div className="mt-12 pt-8 border-t">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            ¿Listo para comprar? Usa tus direcciones guardadas en el checkout
          </p>
          <Button onClick={() => router.push('/checkout')}>
            Ir al Checkout
          </Button>
        </div>
      </div>
    </div>
  );
}
