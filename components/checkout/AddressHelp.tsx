'use client';

import { useState } from 'react';
import { 
  Info, 
  MapPin, 
  Phone, 
  Building, 
  Home,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface AddressHelpProps {
  onFieldFocus?: (fieldName: string) => void;
}

export function AddressHelp({ onFieldFocus }: AddressHelpProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'examples' | 'tips'>('general');

  const handleFieldClick = (fieldName: string) => {
    onFieldFocus?.(fieldName);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-2 mb-3">
        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
        <div>
          <h3 className="font-semibold text-blue-900">Ayuda para completar dirección</h3>
          <p className="text-sm text-blue-700 mt-1">
            Completa correctamente los datos para evitar errores en el envío
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={activeTab === 'general' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('general')}
          className="text-xs"
        >
          General
        </Button>
        <Button
          variant={activeTab === 'examples' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('examples')}
          className="text-xs"
        >
          Ejemplos
        </Button>
        <Button
          variant={activeTab === 'tips' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('tips')}
          className="text-xs"
        >
          Consejos
        </Button>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {activeTab === 'general' && (
          <div className="grid gap-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Código Postal</p>
                <p className="text-xs text-gray-600">
                  Formato: 5500, M5500, 1001, C1001ABA
                </p>
                <button
                  onClick={() => handleFieldClick('codigoPostal')}
                  className="text-xs text-blue-600 hover:underline mt-1"
                >
                  Completar campo →
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Home className="h-4 w-4 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Dirección y Número</p>
                <p className="text-xs text-gray-600">
                  No escribir &#34;Calle&#34; o &#34;Avenida&#34; antes del nombre
                </p>
                <button
                  onClick={() => handleFieldClick('direccion')}
                  className="text-xs text-blue-600 hover:underline mt-1"
                >
                  Completar campo →
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Building className="h-4 w-4 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Piso/Depto (opcional)</p>
                <p className="text-xs text-gray-600">
                  Solo el nombre de la calle. Ej: Corrientes, San Martín, Santa Fe
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Teléfono</p>
                <p className="text-xs text-gray-600">
                  Formato: 11 1234-5678 o 011 1234-5678
                </p>
                <button
                  onClick={() => handleFieldClick('telefono')}
                  className="text-xs text-blue-600 hover:underline mt-1"
                >
                  Completar campo →
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'examples' && (
          <div className="space-y-3">
            <div className="bg-white p-3 rounded border border-blue-100">
              <p className="text-xs font-medium text-gray-700 mb-2">✅ Ejemplo Correcto - Capital Federal:</p>
              <p className="text-xs text-gray-600 font-mono">
                Dirección: Corrientes<br/>
                Número: 1234<br/>
                Piso: 4<br/>
                Depto: B<br/>
                Ciudad: Capital Federal<br/>
                Provincia: Capital Federal<br/>
                CP: C1001ABA
              </p>
            </div>

            <div className="bg-white p-3 rounded border border-blue-100">
              <p className="text-xs font-medium text-gray-700 mb-2">✅ Ejemplo Correcto - Mendoza:</p>
              <p className="text-xs text-gray-600 font-mono">
                Dirección: San Martín<br/>
                Número: 567<br/>
                Ciudad: Mendoza<br/>
                Provincia: Mendoza<br/>
                CP: M5500
              </p>
            </div>

            <div className="bg-red-50 p-3 rounded border border-red-100">
              <p className="text-xs font-medium text-red-700 mb-2">❌ Errores Comunes:</p>
              <ul className="text-xs text-red-600 space-y-1">
                <li>• No escribir &#34;Calle&#34; o &#34;Avenida&#34; antes del nombre</li>
                <li>• No usar abreviaturas como &#34;Sta.&#34; en lugar de &#34;Santa&#34;</li>
                <li>• El teléfono debe tener 10 dígitos (sin 15)</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'tips' && (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <p className="text-xs text-gray-600">
                <strong>Tip:</strong> El código postal con letra (M5500) es válido para Argentina
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <p className="text-xs text-gray-600">
                <strong>Tip:</strong> Si no tienes piso/depto, deja esos campos vacíos
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <p className="text-xs text-gray-600">
                <strong>Tip:</strong> Usa el nombre exacto de tu ciudad para evitar demoras
              </p>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
              <p className="text-xs text-gray-600">
                <strong>Importante:</strong> Un teléfono correcto ayuda al mensajero a contactarte
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
