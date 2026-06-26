'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  AlertCircle
} from 'lucide-react';

interface ValidationRule {
  field: string;
  isValid: boolean;
  message: string;
  type: 'success' | 'warning' | 'error';
}

interface AddressValidationProps {
  formData: {
    nombre?: string;
    direccion?: string;
    numero?: string;
    ciudad?: string;
    provincia?: string;
    codigoPostal?: string;
    telefono?: string;
  };
  onValidationChange?: (isValid: boolean) => void;
}

export function AddressValidation({ formData, onValidationChange }: AddressValidationProps) {
  const [validations, setValidations] = useState<ValidationRule[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  // Validaciones en tiempo real
  useEffect(() => {
    const rules: ValidationRule[] = [];

    // Validar nombre
    if (formData.nombre) {
      if (formData.nombre.length < 2) {
        rules.push({
          field: 'nombre',
          isValid: false,
          message: 'El nombre debe tener al menos 2 caracteres',
          type: 'error'
        });
      } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(formData.nombre)) {
        rules.push({
          field: 'nombre',
          isValid: false,
          message: 'El nombre solo puede contener letras y espacios',
          type: 'error'
        });
      } else {
        rules.push({
          field: 'nombre',
          isValid: true,
          message: 'Nombre válido',
          type: 'success'
        });
      }
    }

    // Validar dirección
    if (formData.direccion) {
      if (formData.direccion.length < 5) {
        rules.push({
          field: 'direccion',
          isValid: false,
          message: 'La dirección debe tener al menos 5 caracteres',
          type: 'error'
        });
      } else if (/^(calle|avenida|av\.|calle\s)/i.test(formData.direccion)) {
        rules.push({
          field: 'direccion',
          isValid: false,
          message: 'No incluir "Calle" o "Avenida" al inicio',
          type: 'warning'
        });
      } else {
        rules.push({
          field: 'direccion',
          isValid: true,
          message: 'Dirección válida',
          type: 'success'
        });
      }
    }

    // Validar número
    if (formData.numero) {
      if (!/^\d+[A-Za-z0-9]*$/.test(formData.numero)) {
        rules.push({
          field: 'numero',
          isValid: false,
          message: 'Formato inválido. Ej: 123, 123A',
          type: 'error'
        });
      } else {
        rules.push({
          field: 'numero',
          isValid: true,
          message: 'Número válido',
          type: 'success'
        });
      }
    }

    // Validar código postal
    if (formData.codigoPostal) {
      if (!/^[A-Z]?\d{4}[A-Z]{0,3}$/.test(formData.codigoPostal)) {
        rules.push({
          field: 'codigoPostal',
          isValid: false,
          message: 'Formato inválido. Ej: 5500, M5500, C1001ABC',
          type: 'error'
        });
      } else {
        rules.push({
          field: 'codigoPostal',
          isValid: true,
          message: 'Código postal válido',
          type: 'success'
        });
      }
    }

    // Validar teléfono
    if (formData.telefono) {
      const cleanPhone = formData.telefono.replace(/[-\s]/g, '');
      if (!/^(?:(?:00)?549?)?0?(?:11|[2368]\d)(?:(?=\d{0,2}15)\d{2})??\d{8}$/.test(cleanPhone)) {
        rules.push({
          field: 'telefono',
          isValid: false,
          message: 'Teléfono inválido. Ej: 1123456789',
          type: 'error'
        });
      } else if (cleanPhone.includes('15')) {
        rules.push({
          field: 'telefono',
          isValid: false,
          message: 'No incluir el 15 en el número',
          type: 'warning'
        });
      } else {
        rules.push({
          field: 'telefono',
          isValid: true,
          message: 'Teléfono válido',
          type: 'success'
        });
      }
    }

    setValidations(rules);
    
    // Notificar si todos los campos requeridos son válidos
    const requiredFields = ['nombre', 'direccion', 'numero', 'ciudad', 'provincia', 'codigoPostal', 'telefono'];
    const allValid = requiredFields.every(field => {
      const validation = rules.find(r => r.field === field);
      return validation && validation.isValid && formData[field as keyof typeof formData];
    });
    
    onValidationChange?.(allValid);
  }, [formData, onValidationChange]);

  const hasErrors = validations.some(v => v.type === 'error');
  const hasWarnings = validations.some(v => v.type === 'warning');
  const allValid = validations.length > 0 && !hasErrors && !hasWarnings;

  if (validations.length === 0) {
    return null;
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Resumen de validación */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {allValid ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                Todos los campos son válidos
              </span>
            </>
          ) : hasErrors ? (
            <>
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-red-700">
                Hay errores que deben corregirse
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">
                Hay advertencias a revisar
              </span>
            </>
          )}
        </div>
        
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          {showDetails ? 'Ocultar' : 'Mostrar'} detalles
        </button>
      </div>

      {/* Detalles de validación */}
      {showDetails && (
        <div className="space-y-2">
          {validations.map((validation, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 text-sm ${
                validation.type === 'success' ? 'text-green-600' :
                validation.type === 'warning' ? 'text-amber-600' :
                'text-red-600'
              }`}
            >
              {validation.type === 'success' ? (
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <span className="capitalize">{validation.field}:</span>
              <span>{validation.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
