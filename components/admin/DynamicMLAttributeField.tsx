'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MLAttribute {
  id: string;
  name: string;
  type: string;
  tags?: {
    required?: boolean;
    catalog_required?: boolean;
    allow_variations?: boolean;
    conditional_required?: boolean;
  };
  value_type?: string;
  values?: Array<{
    id?: string;
    name: string;
  }>;
  help_value?: string;
  allowed_units?: string[];
  max_length?: number;
  min_value?: number;
  max_value?: number;
}

interface DynamicMLAttributeFieldProps {
  attribute: MLAttribute;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function DynamicMLAttributeField({ 
  attribute, 
  value, 
  onChange, 
  error 
}: DynamicMLAttributeFieldProps) {
  const [touched, setTouched] = useState(false);
  
  const isRequired = attribute.tags?.required || attribute.tags?.catalog_required;
  const hasError = error && touched;
  
  // Renderizar campo según el tipo de atributo
  const renderField = () => {
    // Si tiene valores predefinidos, mostrar un select
    if (attribute.values && attribute.values.length > 0) {
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={hasError ? 'border-red-500' : ''}>
            <SelectValue placeholder={`Seleccionar ${attribute.name.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {attribute.values.map((option) => (
              <SelectItem key={option.id || option.name} value={option.id || option.name}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    
    // Campo numérico
    if (attribute.value_type === 'number') {
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Ingrese ${attribute.name.toLowerCase()}`}
          className={hasError ? 'border-red-500' : ''}
          min={attribute.min_value}
          max={attribute.max_value}
          onBlur={() => setTouched(true)}
        />
      );
    }
    
    // Campo de texto con validación de longitud
    return (
      <Input
        type="text"
        value={value}
        onChange={(e) => {
          // Validar longitud máxima si está especificada
          if (attribute.max_length && e.target.value.length > attribute.max_length) {
            return;
          }
          onChange(e.target.value);
        }}
        placeholder={`Ingrese ${attribute.name.toLowerCase()}`}
        className={hasError ? 'border-red-500' : ''}
        maxLength={attribute.max_length}
        onBlur={() => setTouched(true)}
      />
    );
  };
  
  return (
    <div className="space-y-2">
      <Label className="font-medium flex items-center gap-2">
        {attribute.name}
        {isRequired && <Badge variant="destructive" className="text-xs">Obligatorio</Badge>}
        {attribute.tags?.allow_variations && (
          <Badge variant="secondary" className="text-xs">Variaciones</Badge>
        )}
      </Label>
      
      {renderField()}
      
      {/* Mensaje de ayuda */}
      {attribute.help_value && (
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{attribute.help_value}</span>
        </div>
      )}
      
      {/* Unidades permitidas */}
      {attribute.allowed_units && attribute.allowed_units.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Unidades: {attribute.allowed_units.join(', ')}
        </p>
      )}
      
      {/* Error de validación */}
      {hasError && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {error}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Indicador de longitud máxima */}
      {attribute.max_length && value && (
        <p className="text-xs text-muted-foreground text-right">
          {value.length}/{attribute.max_length} caracteres
        </p>
      )}
    </div>
  );
}
