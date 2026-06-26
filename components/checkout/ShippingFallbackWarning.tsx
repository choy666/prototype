'use client';

import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

interface ShippingFallbackWarningProps {
  isFallback: boolean;
  warnings?: string[];
  calculationSource?: 'ME2' | 'FALLBACK';
  className?: string;
}

export function ShippingFallbackWarning({
  isFallback,
  warnings = [],
  calculationSource,
  className = '',
}: ShippingFallbackWarningProps) {
  // No mostrar advertencia si no es fallback y no hay warnings
  if (!isFallback && warnings.length === 0) {
    return null;
  }

  // Determinar tipo de advertencia y estilos
  const isWarning = isFallback || calculationSource === 'FALLBACK';
  // isInfo no utilizado pero mantenido para futuras expansiones

  const baseClasses = 'rounded-md p-3 mb-4 flex items-start gap-3';
  const variantClasses = isWarning 
    ? 'bg-amber-50 border border-amber-200 text-amber-800'
    : 'bg-blue-50 border border-blue-200 text-blue-800';

  const Icon = isWarning ? AlertTriangle : Info;

  return (
    <div className={`${baseClasses} ${variantClasses} ${className}`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm mb-1">
          {isWarning ? 'Información importante sobre el envío' : 'Nota sobre el cálculo'}
        </h4>
        
        <div className="text-sm space-y-1">
          {isWarning && (
            <p>
              El costo de envío se estima; para confirmar, el envío final puede variar. 
              Estamos usando el método de cálculo alternativo disponible para tu código postal.
            </p>
          )}
          
          {warnings.length > 0 && (
            <div className="mt-2">
              <p className="font-medium text-xs mb-1">Detalles adicionales:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                {warnings.slice(0, 3).map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
                {warnings.length > 3 && (
                  <li className="text-xs opacity-75">
                    Y {warnings.length - 3} advertencias más...
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
        
        {/* Información de debug en desarrollo */}
        {process.env.NODE_ENV === 'development' && calculationSource && (
          <div className="mt-2 pt-2 border-t border-current/20">
            <p className="text-xs opacity-75">
              Source: {calculationSource} | Warnings: {warnings.length}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente simplificado para inline usage
export function CompactShippingWarning({
  isFallback,
  className = '',
}: {
  isFallback: boolean;
  className?: string;
}) {
  if (!isFallback) return null;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-800 rounded-md text-sm ${className}`}>
      <AlertTriangle className="w-4 h-4" />
      <span>Envío estimado - el costo final puede variar</span>
    </div>
  );
}
