'use client';

import { useMemo } from 'react';
import {
  LOGISTIC_TYPE_OPTIONS,
  SHIPPING_MODE_OPTIONS,
  type ShippingAttributesInput,
} from '@/lib/validations/shipping-attributes';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

type ShippingAttributesValue = Partial<ShippingAttributesInput> | undefined;

interface ShippingAttributesFormProps {
  value?: ShippingAttributesValue | null;
  onChange: (value: ShippingAttributesValue) => void;
  disabled?: boolean;
}

const logisticTypeLabels: Record<(typeof LOGISTIC_TYPE_OPTIONS)[number], string> = {
  drop_off: 'Drop off',
  xd_drop_off: 'Cross docking (XD drop off)',
  cross_docking: 'Cross docking',
  fulfillment: 'Fulfillment',
  store_pick_up: 'Retiro en tienda',
  not_specified: 'No especificado',
  self_service: 'Self service',
};

const shippingModeLabels: Record<(typeof SHIPPING_MODE_OPTIONS)[number], string> = {
  me1: 'Mercado Envíos 1',
  me2: 'Mercado Envíos 2',
  custom: 'Envío personalizado',
  not_specified: 'No especificado',
};

export function ShippingAttributesForm({
  value,
  onChange,
  disabled = false,
}: ShippingAttributesFormProps) {
  const currentValue = useMemo(() => value ?? {}, [value]);

  const updateField = (field: keyof ShippingAttributesInput, nextValue: unknown) => {
    const draft = { ...currentValue };

    const shouldRemove =
      nextValue === undefined ||
      nextValue === '' ||
      (Array.isArray(nextValue) && nextValue.length === 0);

    if (shouldRemove) {
      delete draft[field];
    } else {
      draft[field] = nextValue as never;
    }

    const hasKeys = Object.keys(draft).length > 0;
    onChange(hasKeys ? draft : undefined);
  };

  const handleToggle = (field: 'local_pick_up' | 'free_shipping') => (checked: boolean) => {
    updateField(field, checked);
  };

  const handleTagsChange = (raw: string) => {
    const tags = raw
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    updateField('tags', tags);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-dark-text-primary">Modo de envío preferido</Label>
          <Select
            value={(currentValue.mode as string) || 'me2'}
            onValueChange={(val) => updateField('mode', val)}
            disabled={disabled}
          >
            <SelectTrigger className="mt-1 bg-dark-lighter border-dark-lighter text-dark-text-primary">
              <SelectValue placeholder="Seleccionar modo" />
            </SelectTrigger>
            <SelectContent>
              {SHIPPING_MODE_OPTIONS.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {shippingModeLabels[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-dark-text-primary">Tipo logístico (Mercado Libre)</Label>
          <Select
            value={(currentValue.logistic_type as string) || 'drop_off'}
            onValueChange={(val) => updateField('logistic_type', val)}
            disabled={disabled}
          >
            <SelectTrigger className="mt-1 bg-dark-lighter border-dark-lighter text-dark-text-primary">
              <SelectValue placeholder="Seleccionar tipo logístico" />
            </SelectTrigger>
            <SelectContent>
              {LOGISTIC_TYPE_OPTIONS.map((type) => (
                <SelectItem key={type} value={type}>
                  {logisticTypeLabels[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-dark-lighter bg-dark-lightest p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-dark-text-primary">Retiro local habilitado</p>
              <p className="text-xs text-dark-text-secondary">
                Permite que los compradores retiren el producto en tu depósito o tienda.
              </p>
            </div>
            <Switch
              checked={Boolean(currentValue.local_pick_up)}
              onCheckedChange={handleToggle('local_pick_up')}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="rounded-lg border border-dark-lighter bg-dark-lightest p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-dark-text-primary">Ofrecer envío gratis</p>
              <p className="text-xs text-dark-text-secondary">
                Mejora la conversión en listados competitivos.
              </p>
            </div>
            <Switch
              checked={Boolean(currentValue.free_shipping)}
              onCheckedChange={handleToggle('free_shipping')}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-dark-text-primary">Tiempo de preparación (horas)</Label>
          <Input
            type="number"
            min={0}
            max={120}
            value={
              currentValue.handling_time !== undefined ? String(currentValue.handling_time) : ''
            }
            onChange={(event) => {
              const val = event.target.value;
              if (val === '') {
                updateField('handling_time', undefined);
                return;
              }
              const parsed = Number(val);
              if (Number.isFinite(parsed)) {
                updateField('handling_time', parsed);
              }
            }}
            placeholder="0"
            className="mt-1"
            disabled={disabled}
          />
        </div>

        <div className="md:col-span-2">
          <Label className="text-dark-text-primary">Dimensiones exactas (LxAxP,PESO)</Label>
          <Input
            value={(currentValue.dimensions as string) || ''}
            onChange={(event) => updateField('dimensions', event.target.value)}
            placeholder="Ej: 20x30x10,0.5"
            className="mt-1"
            disabled={disabled}
          />
          <p className="text-xs text-dark-text-secondary mt-1">
            Usa centímetros y kilogramos. Formato requerido: alto x ancho x largo, peso.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-dark-text-primary">Etiquetas (tags)</Label>
          <Input
            value={Array.isArray(currentValue.tags) ? currentValue.tags.join(', ') : ''}
            onChange={(event) => handleTagsChange(event.target.value)}
            placeholder="ej: me2_shipping, fragile"
            className="mt-1"
            disabled={disabled}
          />
          <p className="text-xs text-dark-text-secondary mt-1">
            Separá cada etiqueta con una coma.
          </p>
        </div>

        <div>
          <Label className="text-dark-text-primary">ID de domicilio de retiro (opcional)</Label>
          <Input
            value={(currentValue.receiver_address_id as string) || ''}
            onChange={(event) => updateField('receiver_address_id', event.target.value)}
            placeholder="ID oficial de dirección en ML"
            className="mt-1"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
