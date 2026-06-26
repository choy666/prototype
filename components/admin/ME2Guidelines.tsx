'use client';

import { AlertCircle, Package, Weight, Ruler } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface ME2GuidelinesProps {
  dimensions?: {
    height?: number;
    width?: number;
    length?: number;
    weight?: number;
  };
  showWarnings?: boolean;
}

export function ME2Guidelines({ dimensions, showWarnings = true }: ME2GuidelinesProps) {
  // Límites ME2 para Argentina
  const limits = {
    maxWeight: 30, // kg
    maxSideLength: 100, // cm por lado
    maxSumSides: 200, // cm suma de todos los lados
    minWeight: 0.01, // kg
    minDimension: 1, // cm
  };

  // Calcular suma de lados
  const sumSides = (dimensions?.height || 0) + (dimensions?.width || 0) + (dimensions?.length || 0);
  
  // Verificar si excede límites
  const warnings = [];
  
  if (dimensions) {
    if (dimensions.weight && dimensions.weight > limits.maxWeight) {
      warnings.push(`Peso excede el máximo de ${limits.maxWeight}kg`);
    }
    if (dimensions.height && dimensions.height > limits.maxSideLength) {
      warnings.push(`Alto excede el máximo de ${limits.maxSideLength}cm`);
    }
    if (dimensions.width && dimensions.width > limits.maxSideLength) {
      warnings.push(`Ancho excede el máximo de ${limits.maxSideLength}cm`);
    }
    if (dimensions.length && dimensions.length > limits.maxSideLength) {
      warnings.push(`Largo excede el máximo de ${limits.maxSideLength}cm`);
    }
    if (sumSides > limits.maxSumSides) {
      warnings.push(`La suma de lados (${sumSides}cm) excede el máximo de ${limits.maxSumSides}cm`);
    }
  }

  const hasWarnings = warnings.length > 0;

  return (
    <div className="space-y-4">
      {/* Título */}
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Requisitos Mercado Envíos 2 (ME2)</h3>
        <Badge variant="secondary" className="text-xs">Argentina</Badge>
      </div>

      {/* Información importante */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Importante:</strong> Para usar ME2, tu cuenta de Mercado Libre debe tener activado ME2 en 
          <a href="https://vendedores.mercadolibre.com.ar/mercado-envios" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
            Configuración de Envíos
          </a>
        </AlertDescription>
      </Alert>

      {/* Límites */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Weight className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Peso</span>
          </div>
          <div className="pl-6 space-y-1 text-sm text-muted-foreground">
            <div>Mínimo: {limits.minWeight}kg</div>
            <div>Máximo: {limits.maxWeight}kg</div>
            {dimensions?.weight && (
              <div className={dimensions.weight > limits.maxWeight ? "text-red-600 font-medium" : "text-green-600"}>
                Actual: {dimensions.weight}kg
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Dimensiones</span>
          </div>
          <div className="pl-6 space-y-1 text-sm text-muted-foreground">
            <div>Mínimo por lado: {limits.minDimension}cm</div>
            <div>Máximo por lado: {limits.maxSideLength}cm</div>
            <div>Suma máxima: {limits.maxSumSides}cm</div>
            {dimensions && (
              <div className={sumSides > limits.maxSumSides ? "text-red-600 font-medium" : "text-green-600"}>
                Suma actual: {sumSides}cm
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advertencias */}
      {showWarnings && hasWarnings && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium">El producto no cumple los requisitos ME2:</div>
              {warnings.map((warning, index) => (
                <div key={index} className="text-sm">• {warning}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Recomendaciones */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Recomendaciones:</h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Usa embalajes seguros que protejan el producto</li>
          <li>• Las dimensiones deben incluir el embalaje</li>
          <li>• Pesa el producto ya embalado</li>
          <li>• Para productos frágiles, considera embalajes adicionales</li>
          <li>• Si excedes los límites, considera dividir en varios productos</li>
        </ul>
      </div>

      {/* Formato esperado */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <h4 className="font-medium mb-2">Formato para Mercado Libre:</h4>
        <code className="text-sm bg-white dark:bg-gray-900 px-2 py-1 rounded">
          {dimensions 
            ? `${dimensions.height || 0}x${dimensions.width || 0}x${dimensions.length || 0},${dimensions.weight || 0}`
            : "ALTOxANCHOxLARGO,PESO"
          }
        </code>
        <p className="text-xs text-muted-foreground mt-1">
          Ejemplo: 20x30x40,0.5 (20cm alto x 30cm ancho x 40cm largo x 0.5kg)
        </p>
      </div>
    </div>
  );
}
