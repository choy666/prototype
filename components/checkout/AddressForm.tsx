'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addressSchema, type Address } from '@/lib/validations/checkout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Info } from 'lucide-react';
import { AddressHelp } from './AddressHelp';

interface AddressFormProps {
  onSubmit: (data: Address) => void;
  onCancel?: () => void;
  initialData?: Partial<Address>;
  isLoading?: boolean;
  submitLabel?: string;
  showCancel?: boolean;
}

// Tipo extendido para incluir campos opcionales
type ExtendedAddress = Address & {
  piso?: string;
  departamento?: string;
};

export function AddressForm({
  onSubmit,
  onCancel,
  initialData,
  isLoading = false,
  submitLabel = 'Guardar Dirección',
  showCancel = true
}: AddressFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHelp, setShowHelp] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<ExtendedAddress>({
    resolver: zodResolver(addressSchema),
    mode: 'onBlur',
    defaultValues: initialData,
  });

  const handleFieldFocus = (fieldName: string) => {
    setFocus(fieldName as keyof ExtendedAddress);
  };

  const handleFormSubmit = async (data: ExtendedAddress) => {
    setIsSubmitting(true);
    try {
      // Filtrar campos opcionales antes de enviar
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { piso, departamento, ...addressData } = data;
      await onSubmit(addressData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormLoading = isLoading || isSubmitting;

  return (
    <div className="space-y-6">
      {/* Componente de ayuda visual */}
      {showHelp && (
        <AddressHelp onFieldFocus={handleFieldFocus} />
      )}

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Dirección de Envío</h3>
            <p className="text-sm text-muted-foreground">
              Completa los datos de envío correctamente
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
            className="text-blue-600 hover:text-blue-700"
          >
            <Info className="h-4 w-4 mr-1" />
            {showHelp ? 'Ocultar' : 'Mostrar'} ayuda
          </Button>
        </div>

      {/* Instrucciones para navegación por teclado */}
      <div className="sr-only" aria-live="polite">
        Usa Tab para navegar entre campos. Presiona Enter para enviar el formulario.
      </div>

      {/* Nombre Completo */}
      <div className="space-y-2">
        <Label htmlFor="nombre">
          Nombre Completo <span className="text-red-500">*</span>
        </Label>
        <Input
          id="nombre"
          type="text"
          placeholder="Juan Pérez"
          disabled={isFormLoading}
          {...register('nombre')}
          aria-invalid={!!errors.nombre}
          aria-describedby={errors.nombre ? 'nombre-error' : undefined}
        />
        {errors.nombre && (
          <p id="nombre-error" className="text-sm text-red-500" role="alert">
            {errors.nombre.message}
          </p>
        )}
      </div>

      {/* Dirección */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="direccion">
            Dirección <span className="text-red-500">*</span>
          </Label>
          <div className="group relative">
            <Info className="h-4 w-4 text-gray-400 cursor-help" />
            <div className="absolute bottom-full left-0 mb-2 hidden w-64 p-2 text-xs bg-gray-800 text-white rounded-lg group-hover:block z-10">
              Solo el nombre de la calle. Ej: Corrientes, San Martín, Santa Fe
              <div className="absolute top-full left-4 -mt-1 w-2 h-2 bg-gray-800 transform rotate-45"></div>
            </div>
          </div>
        </div>
        <Input
          id="direccion"
          type="text"
          placeholder="Ej: Corrientes"
          disabled={isFormLoading}
          {...register('direccion')}
          aria-invalid={!!errors.direccion}
          aria-describedby={errors.direccion ? 'direccion-error' : 'direccion-help'}
        />
        <p id="direccion-help" className="text-xs text-gray-500">
          No incluir &#34;Calle&#34;, &#34;Avenida&#34; ni &#34;Av.&#34;
        </p>
        {errors.direccion && (
          <p id="direccion-error" className="text-sm text-red-500" role="alert">
            {errors.direccion.message}
          </p>
        )}
      </div>

      {/* Número */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="numero">
            Número <span className="text-red-500">*</span>
          </Label>
          <div className="group relative">
            <Info className="h-4 w-4 text-gray-400 cursor-help" />
            <div className="absolute bottom-full left-0 mb-2 hidden w-64 p-2 text-xs bg-gray-800 text-white rounded-lg group-hover:block z-10">
              Número de la calle. Puede incluir letras. Ej: 123, 456A, 789B
              <div className="absolute top-full left-4 -mt-1 w-2 h-2 bg-gray-800 transform rotate-45"></div>
            </div>
          </div>
        </div>
        <Input
          id="numero"
          type="text"
          placeholder="Ej: 1234"
          disabled={isFormLoading}
          {...register('numero')}
          aria-invalid={!!errors.numero}
          aria-describedby={errors.numero ? 'numero-error' : 'numero-help'}
        />
        <p id="numero-help" className="text-xs text-gray-500">
          Solo el número. Si tiene letra, agrégala (ej: 123A)
        </p>
        {errors.numero && (
          <p id="numero-error" className="text-sm text-red-500" role="alert">
            {errors.numero.message}
          </p>
        )}
      </div>

      {/* Ciudad y Provincia */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ciudad">
            Ciudad <span className="text-red-500">*</span>
          </Label>
          <Input
            id="ciudad"
            type="text"
            placeholder="Buenos Aires"
            disabled={isFormLoading}
            {...register('ciudad')}
            aria-invalid={!!errors.ciudad}
            aria-describedby={errors.ciudad ? 'ciudad-error' : undefined}
          />
          {errors.ciudad && (
            <p id="ciudad-error" className="text-sm text-red-500" role="alert">
              {errors.ciudad.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="provincia">
            Provincia <span className="text-red-500">*</span>
          </Label>
          <Input
            id="provincia"
            type="text"
            placeholder="Buenos Aires"
            disabled={isFormLoading}
            {...register('provincia')}
            aria-invalid={!!errors.provincia}
            aria-describedby={errors.provincia ? 'provincia-error' : undefined}
          />
          {errors.provincia && (
            <p id="provincia-error" className="text-sm text-red-500" role="alert">
              {errors.provincia.message}
            </p>
          )}
        </div>
      </div>

      {/* Código Postal y Teléfono */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="codigoPostal">
              Código Postal <span className="text-red-500">*</span>
            </Label>
            <div className="group relative">
              <Info className="h-4 w-4 text-gray-400 cursor-help" />
              <div className="absolute bottom-full left-0 mb-2 hidden w-64 p-2 text-xs bg-gray-800 text-white rounded-lg group-hover:block z-10">
                Formatos válidos: 5500, M5500, 1001, C1001ABC
                <div className="absolute top-full left-4 -mt-1 w-2 h-2 bg-gray-800 transform rotate-45"></div>
              </div>
            </div>
          </div>
          <Input
            id="codigoPostal"
            type="text"
            placeholder="Ej: 5500 o M5500"
            disabled={isFormLoading}
            {...register('codigoPostal')}
            aria-invalid={!!errors.codigoPostal}
            aria-describedby={errors.codigoPostal ? 'codigoPostal-error' : 'codigoPostal-help'}
          />
          <p id="codigoPostal-help" className="text-xs text-gray-500">
            Puede incluir letra de provincia (M5500 para Mendoza)
          </p>
          {errors.codigoPostal && (
            <p id="codigoPostal-error" className="text-sm text-red-500" role="alert">
              {errors.codigoPostal.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="telefono">
              Teléfono <span className="text-red-500">*</span>
            </Label>
            <div className="group relative">
              <Info className="h-4 w-4 text-gray-400 cursor-help" />
              <div className="absolute bottom-full right-0 mb-2 hidden w-64 p-2 text-xs bg-gray-800 text-white rounded-lg group-hover:block z-10">
                10 dígitos sin 15. Ej: 1123456789 o 01112345678
                <div className="absolute top-full right-4 -mt-1 w-2 h-2 bg-gray-800 transform rotate-45"></div>
              </div>
            </div>
          </div>
          <Input
            id="telefono"
            type="tel"
            placeholder="Ej: 1123456789"
            disabled={isFormLoading}
            {...register('telefono')}
            aria-invalid={!!errors.telefono}
            aria-describedby={errors.telefono ? 'telefono-error' : 'telefono-help'}
          />
          <p id="telefono-help" className="text-xs text-gray-500">
            Sin código de país ni 15. Ej: 11 1234-5678
          </p>
          {errors.telefono && (
            <p id="telefono-error" className="text-sm text-red-500" role="alert">
              {errors.telefono.message}
            </p>
          )}
        </div>
      </div>

      {/* Piso y Departamento (opcionales) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="piso">
            Piso (opcional)
          </Label>
          <Input
            id="piso"
            type="text"
            placeholder="5"
            disabled={isFormLoading}
            {...register('piso')}
            aria-invalid={!!errors.piso}
            aria-describedby={errors.piso ? 'piso-error' : undefined}
          />
          {errors.piso && (
            <p id="piso-error" className="text-sm text-red-500" role="alert">
              {errors.piso.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="departamento">
            Departamento (opcional)
          </Label>
          <Input
            id="departamento"
            type="text"
            placeholder="B"
            disabled={isFormLoading}
            {...register('departamento')}
            aria-invalid={!!errors.departamento}
            aria-describedby={errors.departamento ? 'departamento-error' : undefined}
          />
          {errors.departamento && (
            <p id="departamento-error" className="text-sm text-red-500" role="alert">
              {errors.departamento.message}
            </p>
          )}
        </div>
      </div>

      {/* Botones */}
      <div className="flex gap-3">
        <Button
          type="submit"
          className="flex-1"
          disabled={isFormLoading}
          aria-busy={isFormLoading}
        >
          {isFormLoading ? 'Guardando...' : submitLabel}
        </Button>

        {showCancel && onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isFormLoading}
            className="flex-1"
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
    </div>
  );
}
