'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2, MapPin, AlertCircle } from 'lucide-react';
import { logger } from '@/lib/utils/logger';

interface AddressComponents {
  street: string;
  number: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  display_name: string;
}

interface AddressAutocompleteFreeProps {
  onAddressSelect: (address: AddressComponents) => void;
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
}

export type { AddressComponents };

export function AddressAutocompleteFree({
  onAddressSelect,
  placeholder = 'Ingresa tu dirección...',
  defaultValue = '',
  disabled = false
}: AddressAutocompleteFreeProps) {
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressComponents[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Extraer componentes de dirección del resultado de Nominatim
  const extractAddressComponents = useCallback(
    (place: {
      display_name?: string;
      address?: {
        road?: string;
        street?: string;
        house_number?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        postcode?: string;
      };
    }): AddressComponents | null => {
      if (!place) return null;

      const components: AddressComponents = {
        street: '',
        number: '',
        city: '',
        state: '',
        zipcode: '',
        country: 'Argentina',
        display_name: place.display_name || ''
      };

      // Extraer componentes del address
      if (place.address) {
        components.street = place.address.road || place.address.street || '';
        components.number = place.address.house_number || '';
        components.city = place.address.city || place.address.town || place.address.village || '';
        components.state = place.address.state || '';
        components.zipcode = place.address.postcode || '';
      }

      // Si no hay número, intentar extraerlo del nombre
      if (!components.number && place.display_name) {
        const match = place.display_name.match(/(\d+)\s/);
        if (match) {
          components.number = match[1];
        }
      }

      return components;
    },
    []
  );

  // Validar zipcode con API de Mercado Libre
  const validateZipcode = useCallback(async (zipcode: string) => {
    if (!zipcode) return false;

    try {
      const response = await fetch(`/api/zipcode/validate?zipcode=${zipcode}`);
      
      if (response.ok) {
        const data = await response.json();
        return data.valid;
      }
      
      return false;
    } catch (error) {
      logger.error('[AddressAutocomplete] Error validando zipcode', {
        zipcode,
        error
      });
      return false;
    }
  }, []);

  // Buscar direcciones con Nominatim (OpenStreetMap)
  const searchAddresses = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ar&addressdetails=1&limit=5`,
        {
          headers: {
            'User-Agent': 'MiEcommerce-Prototype/1.0'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const addresses = data.map(extractAddressComponents).filter(Boolean);
        setSuggestions(addresses);
        setShowSuggestions(true);
      } else {
        throw new Error('Error al buscar direcciones');
      }
    } catch (error) {
      logger.error('[AddressAutocomplete] Error buscando direcciones', {
        query,
        error
      });
      setError('Error al buscar direcciones');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [extractAddressComponents]);

  // Manejar cambios en el input con debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setError(null);

    // Limpiar debounce anterior
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Nuevo debounce
    debounceRef.current = setTimeout(() => {
      searchAddresses(newValue);
    }, 300);
  };

  // Manejar selección de dirección
  const handleSelectAddress = async (address: AddressComponents) => {
    setValue(address.display_name);
    setShowSuggestions(false);
    setSuggestions([]);

    // Validar zipcode
    if (address.zipcode) {
      setIsValidating(true);
      const isValid = await validateZipcode(address.zipcode);
      setIsValidating(false);

      if (!isValid) {
        setError('El código postal no tiene cobertura de envío');
        return;
      }
    } else {
      setError('La dirección no incluye código postal');
      return;
    }

    onAddressSelect(address);
  };

  // Limpiar debounce al desmontar
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled || loading}
          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        {(loading || isValidating) && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {/* Lista de sugerencias */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((address, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelectAddress(address)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <div className="text-sm font-medium text-gray-900">
                {address.display_name}
              </div>
              {address.zipcode && (
                <div className="text-xs text-gray-500 mt-1">
                  CP: {address.zipcode}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-2 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Ayuda visual */}
      <p className="mt-2 text-xs text-gray-500">
        Escribe tu dirección y selecciona una opción de la lista (100% gratuito)
      </p>
    </div>
  );
}
