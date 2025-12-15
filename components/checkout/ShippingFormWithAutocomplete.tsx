'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AddressAutocompleteFree, AddressComponents } from './AddressAutocompleteFree';
import { ShippingFormData, shippingAddressSchema } from '@/lib/validations/checkout';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ShippingFormWithAutocompleteProps {
  onSubmit: (data: ShippingFormData) => void;
  onCancel: () => void;
  initialData?: Partial<ShippingFormData>;
  isProcessing?: boolean;
}

export function ShippingFormWithAutocomplete({
  onSubmit,
  onCancel,
  initialData,
  isProcessing = false
}: ShippingFormWithAutocompleteProps) {
  const [selectedAddress, setSelectedAddress] = useState<AddressComponents | null>(null);
  
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<ShippingFormData>({
    resolver: zodResolver(shippingAddressSchema),
    defaultValues: {
      nombre: initialData?.nombre || '',
      direccion: initialData?.direccion || '',
      ciudad: initialData?.ciudad || '',
      provincia: initialData?.provincia || '',
      codigoPostal: initialData?.codigoPostal || '',
      telefono: initialData?.telefono || '',
      numero: initialData?.numero || '',
      piso: initialData?.piso || '',
      departamento: initialData?.departamento || '',
    },
  });

  // Manejar selección de dirección del autocomplete
  const handleAddressSelect = (address: AddressComponents) => {
    setSelectedAddress(address);
    
    // Actualizar campos del formulario
    setValue('codigoPostal', address.zipcode);
    setValue('provincia', address.state);
    setValue('ciudad', address.city);
    setValue('direccion', `${address.street} ${address.number}`.trim());
    
    toast.success('Dirección validada correctamente');
  };

  // Enviar formulario
  const onFormSubmit = (data: ShippingFormData) => {
    if (!selectedAddress) {
      toast.error('Por favor, selecciona una dirección de la lista');
      return;
    }
    
    onSubmit({
      ...data,
      // Asegurar que los datos de la dirección seleccionada se usen
      codigoPostal: selectedAddress.zipcode,
      provincia: selectedAddress.state,
      ciudad: selectedAddress.city,
      direccion: `${selectedAddress.street} ${selectedAddress.number}`.trim(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Botón de volver */}
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver
      </button>

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        {/* Información personal */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Información personal</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo
              </label>
              <Input
                {...register('nombre')}
                placeholder="Tu nombre completo"
                className={errors.nombre ? 'border-red-500' : ''}
              />
              {errors.nombre && (
                <p className="mt-1 text-sm text-red-600">{errors.nombre.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <Input
                {...register('telefono')}
                placeholder="Tu teléfono"
                className={errors.telefono ? 'border-red-500' : ''}
              />
              {errors.telefono && (
                <p className="mt-1 text-sm text-red-600">{errors.telefono.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Dirección con Autocomplete */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Dirección de envío</h3>
          <div className="space-y-4">
            <AddressAutocompleteFree
              onAddressSelect={handleAddressSelect}
              placeholder="Busca tu dirección..."
              disabled={isProcessing}
            />
            
            {/* Campos ocultos que se llenan automáticamente */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código Postal
                </label>
                <Input
                  {...register('codigoPostal')}
                  placeholder="Código postal"
                  readOnly
                  className="bg-gray-100"
                />
                {errors.codigoPostal && (
                  <p className="mt-1 text-sm text-red-600">{errors.codigoPostal.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provincia
                </label>
                <Input
                  {...register('provincia')}
                  placeholder="Provincia"
                  readOnly
                  className="bg-gray-100"
                />
                {errors.provincia && (
                  <p className="mt-1 text-sm text-red-600">{errors.provincia.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ciudad
                </label>
                <Input
                  {...register('ciudad')}
                  placeholder="Ciudad"
                  readOnly
                  className="bg-gray-100"
                />
                {errors.ciudad && (
                  <p className="mt-1 text-sm text-red-600">{errors.ciudad.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <Input
                  {...register('direccion')}
                  placeholder="Dirección"
                  readOnly
                  className="bg-gray-100"
                />
                {errors.direccion && (
                  <p className="mt-1 text-sm text-red-600">{errors.direccion.message}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Departamento/Piso (opcional)
                </label>
                <Input
                  {...register('departamento')}
                  placeholder="Ej: Depto 2B, Piso 5"
                  className={errors.departamento ? 'border-red-500' : ''}
                />
                {errors.departamento && (
                  <p className="mt-1 text-sm text-red-600">{errors.departamento.message}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observaciones (opcional)
          </label>
          <textarea
            {...register('piso')}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Piso (opcional)"
          />
        </div>

        {/* Botones */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!isValid || !selectedAddress || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Continuar'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
