'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addressSchema, Address as ValidationAddress } from '@/lib/validations/checkout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

interface AddressFormProps {
  onSubmit: (data: ValidationAddress) => void;
  onCancel?: () => void;
  initialData?: Partial<ValidationAddress>;
  isLoading?: boolean;
  submitLabel?: string;
  showCancel?: boolean;
}

// Tipo extendido para incluir campos opcionales
type ExtendedAddress = ValidationAddress & {
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExtendedAddress>({
    resolver: zodResolver(addressSchema),
    mode: 'onBlur',
    defaultValues: initialData,
  });

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
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Dirección de Envío</h3>
        <p className="text-sm text-muted-foreground">
          Completa los datos de envío
        </p>
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
        <Label htmlFor="direccion">
          Dirección <span className="text-red-500">*</span>
        </Label>
        <Input
          id="direccion"
          type="text"
          placeholder="Av. Corrientes"
          disabled={isFormLoading}
          {...register('direccion')}
          aria-invalid={!!errors.direccion}
          aria-describedby={errors.direccion ? 'direccion-error' : undefined}
        />
        {errors.direccion && (
          <p id="direccion-error" className="text-sm text-red-500" role="alert">
            {errors.direccion.message}
          </p>
        )}
      </div>

      {/* Número */}
      <div className="space-y-2">
        <Label htmlFor="numero">
          Número <span className="text-red-500">*</span>
        </Label>
        <Input
          id="numero"
          type="text"
          placeholder="1234"
          disabled={isFormLoading}
          {...register('numero')}
          aria-invalid={!!errors.numero}
          aria-describedby={errors.numero ? 'numero-error' : undefined}
        />
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
          <Label htmlFor="codigoPostal">
            Código Postal <span className="text-red-500">*</span>
          </Label>
          <Input
            id="codigoPostal"
            type="text"
            placeholder="1234 o C1234ABC"
            disabled={isFormLoading}
            {...register('codigoPostal')}
            aria-invalid={!!errors.codigoPostal}
            aria-describedby={errors.codigoPostal ? 'codigoPostal-error' : undefined}
          />
          {errors.codigoPostal && (
            <p id="codigoPostal-error" className="text-sm text-red-500" role="alert">
              {errors.codigoPostal.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefono">
            Teléfono <span className="text-red-500">*</span>
          </Label>
          <Input
            id="telefono"
            type="tel"
            placeholder="1123456789"
            disabled={isFormLoading}
            {...register('telefono')}
            aria-invalid={!!errors.telefono}
            aria-describedby={errors.telefono ? 'telefono-error' : undefined}
          />
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
  );
}
