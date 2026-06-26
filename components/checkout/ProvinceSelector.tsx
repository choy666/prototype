'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info } from 'lucide-react';

// Provincias con sus códigos de Mercado Libre
const PROVINCES = [
  { name: 'Capital Federal', code: 'AR-C', aliases: ['CABA', 'Ciudad Autónoma de Buenos Aires'] },
  { name: 'Buenos Aires', code: 'AR-B', aliases: [] },
  { name: 'Catamarca', code: 'AR-K', aliases: [] },
  { name: 'Chaco', code: 'AR-H', aliases: [] },
  { name: 'Chubut', code: 'AR-U', aliases: [] },
  { name: 'Córdoba', code: 'AR-X', aliases: [] },
  { name: 'Corrientes', code: 'AR-W', aliases: [] },
  { name: 'Entre Ríos', code: 'AR-E', aliases: [] },
  { name: 'Formosa', code: 'AR-P', aliases: [] },
  { name: 'Jujuy', code: 'AR-Y', aliases: [] },
  { name: 'La Pampa', code: 'AR-L', aliases: [] },
  { name: 'La Rioja', code: 'AR-F', aliases: [] },
  { name: 'Mendoza', code: 'AR-M', aliases: [] },
  { name: 'Misiones', code: 'AR-N', aliases: [] },
  { name: 'Neuquén', code: 'AR-Q', aliases: [] },
  { name: 'Río Negro', code: 'AR-R', aliases: [] },
  { name: 'Salta', code: 'AR-A', aliases: [] },
  { name: 'San Juan', code: 'AR-J', aliases: [] },
  { name: 'San Luis', code: 'AR-D', aliases: [] },
  { name: 'Santa Cruz', code: 'AR-Z', aliases: [] },
  { name: 'Santa Fe', code: 'AR-S', aliases: [] },
  { name: 'Santiago del Estero', code: 'AR-G', aliases: [] },
  { name: 'Tierra del Fuego', code: 'AR-V', aliases: [] },
  { name: 'Tucumán', code: 'AR-T', aliases: [] },
];

interface ProvinceSelectorProps {
  value?: string;
  onChange: (value: string, code: string) => void;
  disabled?: boolean;
  error?: string;
}

export function ProvinceSelector({ value, onChange, disabled, error }: ProvinceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleValueChange = (selectedValue: string) => {
    const province = PROVINCES.find(p => p.name === selectedValue);
    if (province) {
      onChange(province.name, province.code);
    }
  };

  // Buscar provincia por nombre o alias
  const findProvinceByValue = (searchValue: string) => {
    const normalizedSearch = searchValue.toLowerCase().trim();
    
    // Buscar por nombre exacto
    let province = PROVINCES.find(p => 
      p.name.toLowerCase() === normalizedSearch
    );
    
    // Si no encuentra, buscar por alias
    if (!province) {
      province = PROVINCES.find(p => 
        p.aliases.some(alias => alias.toLowerCase() === normalizedSearch)
      );
    }
    
    return province;
  };

  // Obtener el valor actual del select
  const currentValue = () => {
    if (!value) return '';
    
    const province = findProvinceByValue(value);
    return province?.name || '';
  };

  const selectedProvince = value ? findProvinceByValue(value) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="provincia">
          Provincia <span className="text-red-500">*</span>
        </Label>
        <div className="group relative">
          <Info className="h-4 w-4 text-gray-400 cursor-help" />
          <div className="absolute bottom-full left-0 mb-2 hidden w-64 p-2 text-xs bg-gray-800 text-white rounded-lg group-hover:block z-10">
            Selecciona la provincia para asegurar envíos correctos
            <div className="absolute top-full left-4 -mt-1 w-2 h-2 bg-gray-800 transform rotate-45"></div>
          </div>
        </div>
      </div>

      <Select 
        value={currentValue()} 
        onValueChange={handleValueChange}
        disabled={disabled}
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <SelectTrigger 
          className={error ? 'border-red-500' : ''}
          id="provincia"
          aria-invalid={!!error}
          aria-describedby={error ? 'provincia-error' : undefined}
        >
          <SelectValue placeholder="Selecciona tu provincia" />
        </SelectTrigger>
        <SelectContent>
          {PROVINCES.map((province) => (
            <SelectItem key={province.code} value={province.name}>
              <div className="flex items-center justify-between w-full">
                <span>{province.name}</span>
                <span className="text-xs text-gray-500 ml-2">
                  {province.code}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Mostrar código ML seleccionado */}
      {selectedProvince && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          ✓ Provincia válida para Mercado Libre ({selectedProvince.code})
        </p>
      )}

      {error && (
        <p id="provincia-error" className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {/* Lista de alias comunes */}
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-700">
          Ver alias comunes
        </summary>
        <ul className="mt-1 space-y-1 pl-4">
          <li>• CABA → Capital Federal</li>
          <li>• Ciudad Autónoma de Buenos Aires → Capital Federal</li>
        </ul>
      </details>
    </div>
  );
}
