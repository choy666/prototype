'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, Info, Package, Tag, AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DynamicAttribute } from '@/components/admin/AttributeBuilder'
import { DynamicMLAttributeField } from '@/components/admin/DynamicMLAttributeField';

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

interface MLAttributesGuideProps {
  categoryId: string;
  attributes: DynamicAttribute[];
  onAttributesChange: (attributes: DynamicAttribute[]) => void;
  showValidationErrors?: boolean;
}

export function MLAttributesGuide({ 
  categoryId, 
  attributes, 
  onAttributesChange,
  showValidationErrors = false 
}: MLAttributesGuideProps) {
  const [mlAttributes, setMlAttributes] = useState<{
    category?: {
      id: number;
      name: string;
      mlCategoryId: string;
    };
    mlAttributes?: {
      all: MLAttribute[];
      required: MLAttribute[];
      recommended: MLAttribute[];
      conditional: MLAttribute[];
      optional: MLAttribute[];
      emptyReasons: MLAttribute[];
    };
    summary?: {
      total: number;
      required: number;
      recommended: number;
      conditional: number;
      optional: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [newAttribute, setNewAttribute] = useState({ name: '', value: '' });

  // Cargar atributos de la categoría ML
  useEffect(() => {
    if (!categoryId) {
      setMlAttributes(null);
      return;
    }

    const fetchAttributes = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/mercadolibre/categories/${categoryId}/attributes`);
        if (response.ok) {
          const data = await response.json();
          setMlAttributes(data);
        } else {
          console.warn('Error response from attributes API:', response.status);
          setMlAttributes(null);
        }
      } catch (error) {
        console.error('Error cargando atributos ML:', error);
        // No propagamos el error para no romper la UI
        setMlAttributes(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAttributes();
  }, [categoryId]);

  // Obtener atributos requeridos faltantes
  const getMissingRequiredAttributes = () => {
    if (!mlAttributes?.mlAttributes?.required) return [];
    
    return mlAttributes.mlAttributes.required.filter((required: MLAttribute) => 
      !attributes.some(existing => 
        existing.name.toLowerCase() === required.id.toLowerCase() ||
        (required.id === 'GTIN' && 
         (existing.name.toLowerCase().includes('gtin') || 
          existing.name.toLowerCase().includes('codigo') || 
          existing.name.toLowerCase().includes('ean') ||
          existing.name.toLowerCase().includes('upc'))
        )
      )
    );
  };

  // Obtener atributos recomendados
  const getRecommendedAttributes = () => {
    if (!mlAttributes?.mlAttributes?.recommended) return [];
    return mlAttributes.mlAttributes.recommended.filter((attr: MLAttribute) => 
      !attributes.some(existing => 
        existing.name.toLowerCase() === attr.id.toLowerCase()
      )
    );
  };

  // Obtener atributos condicionalmente requeridos
  const getConditionalAttributes = () => {
    if (!mlAttributes?.mlAttributes?.conditional) return [];
    return mlAttributes.mlAttributes.conditional.filter((attr: MLAttribute) => 
      !attributes.some(existing => 
        existing.name.toLowerCase() === attr.id.toLowerCase()
      )
    );
  };

  // Verificar si EMPTY_GTIN_REASON tiene un valor inválido
  const hasInvalidEmptyGtinReason = () => {
    const emptyGtinAttr = attributes.find(attr => 
      attr.name.toLowerCase() === 'empty_gtin_reason'
    );
    
    if (!emptyGtinAttr || !emptyGtinAttr.values || emptyGtinAttr.values.length === 0) {
      return false;
    }
    
    const currentValue = emptyGtinAttr.values[0];
    const validValues = mlAttributes?.mlAttributes?.emptyReasons
      .find((attr: MLAttribute) => attr.id === 'EMPTY_GTIN_REASON')
      ?.values?.map((v: { id?: string; name: string }) => v.id || '') || [];
    
    // Si el valor actual no está en la lista de IDs válidos, es inválido
    return currentValue && !validValues.includes(currentValue);
  };

  // Estado para valores de atributos dinámicos
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  const isUpdatingFromProps = useRef(false);
  
  // Sincronizar attributeValues con los atributos existentes
  useEffect(() => {
    // Evitar bucle infinito: solo actualizar si los valores realmente cambiaron
    const newValues: Record<string, string> = {};
    attributes.forEach(attr => {
      if (attr.values && attr.values.length > 0) {
        newValues[attr.name] = attr.values[0];
      }
    });
    
    // Comparar valores actuales con nuevos para evitar actualizaciones innecesarias
    const valuesChanged = JSON.stringify(newValues) !== JSON.stringify(attributeValues);
    
    if (valuesChanged && !isUpdatingFromProps.current) {
      isUpdatingFromProps.current = true;
      setAttributeValues(newValues);
      setTimeout(() => { isUpdatingFromProps.current = false; }, 0);
    }
  }, [attributes, attributeValues]);
  
  // Manejar cambio de valor de un atributo dinámico
  const handleAttributeValueChange = (attrId: string, value: string) => {
    setAttributeValues(prev => ({ ...prev, [attrId]: value }));
    
    // Actualizar el array de atributos
    const existingIndex = attributes.findIndex(a => a.name === attrId);
    let updatedAttributes: DynamicAttribute[];
    
    if (existingIndex >= 0) {
      updatedAttributes = [...attributes];
      if (value) {
        updatedAttributes[existingIndex] = {
          ...updatedAttributes[existingIndex],
          values: [value]
        };
      } else {
        // Si el valor está vacío, eliminar el atributo
        updatedAttributes.splice(existingIndex, 1);
      }
    } else if (value) {
      updatedAttributes = [...attributes, {
        id: attrId,
        name: attrId,
        values: [value]
      } as DynamicAttribute & { id: string }];
    } else {
      updatedAttributes = attributes;
    }
    
    onAttributesChange(updatedAttributes);
  };

  // Eliminar un atributo
  const handleRemoveAttribute = (index: number) => {
    const updatedAttributes = attributes.filter((_, i) => i !== index);
    onAttributesChange(updatedAttributes);
  }; 
  const missingRequired = getMissingRequiredAttributes();
  const recommended = getRecommendedAttributes();
  const conditional = getConditionalAttributes();
  const hasErrors = missingRequired.length > 0 && showValidationErrors;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Atributos de Mercado Libre</h3>
          <Badge variant="secondary" className="text-xs">
            {mlAttributes?.summary?.total || 0} disponibles
          </Badge>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {isOpen && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4 animate-pulse" />
              Cargando atributos de la categoría...
            </div>
          ) : (
            <>
              {/* Alerta de atributos requeridos faltantes */}
              {hasErrors && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="font-medium">Faltan atributos obligatorios:</div>
                      {missingRequired.map((attr: MLAttribute, index: number) => (
                        <div key={index} className="text-sm">
                          • <strong>{attr.id || attr.name}</strong>
                          {attr.id === 'GTIN' && (
                            <span className="ml-2 text-xs">
                              (Si el producto no tiene código de barras, usa &quot;NO_GTIN&quot;)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Atributos requeridos */}
              {missingRequired.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h4 className="font-medium text-amber-600 dark:text-amber-400">
                      ⚠️ Atributos Obligatorios Requeridos
                    </h4>
                  </div>
                  <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
                    <Info className="h-4 w-4 text-blue-500" />
                    <AlertDescription className="text-blue-700 dark:text-blue-300">
                      <strong>Importante:</strong> Debes completar estos campos específicos abajo. 
                      No uses el formulario &quot;Agregar Atributo Adicional&quot; para estos atributos obligatorios.
                    </AlertDescription>
                  </Alert>
                  <div className="grid gap-4">
                    {missingRequired.map((attr: MLAttribute) => (
                      <div key={attr.id} className="p-4 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                        <DynamicMLAttributeField
                          attribute={attr}
                          value={attributeValues[attr.id] || ''}
                          onChange={(value) => handleAttributeValueChange(attr.id, value)}
                          error={showValidationErrors && !attributeValues[attr.id] ? 'Este atributo es obligatorio' : ''}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Atributos recomendados */}
              {recommended.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <h4 className="font-medium text-blue-600 dark:text-blue-400">
                      Atributos Recomendados
                    </h4>
                    <Badge variant="outline" className="text-xs">Opcional</Badge>
                  </div>
                  <div className="grid gap-4">
                    {recommended.slice(0, 3).map((attr: MLAttribute) => (
                      <div key={attr.id} className="p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                        <DynamicMLAttributeField
                          attribute={attr}
                          value={attributeValues[attr.id] || ''}
                          onChange={(value) => handleAttributeValueChange(attr.id, value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Atributos condicionalmente requeridos */}
              {conditional.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <h4 className="font-medium text-yellow-600 dark:text-yellow-400">
                      Atributos Condicionalmente Requeridos
                    </h4>
                    <Badge variant="outline" className="text-xs">Recomendado</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Estos atributos pueden ser necesarios dependiendo del producto. 
                    Si no aplica, puedes dejarlos vacíos.
                  </p>
                  <div className="grid gap-4">
                    {conditional.slice(0, 3).map((attr: MLAttribute) => (
                      <div key={attr.id} className="p-4 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                        <DynamicMLAttributeField
                          attribute={attr}
                          value={attributeValues[attr.id] || ''}
                          onChange={(value) => handleAttributeValueChange(attr.id, value)}
                        />
                        {attr.id === 'GTIN' && (
                          <div className="mt-2">
                            <p className="text-sm text-muted-foreground mb-2">
                              Si no tiene GTIN, selecciona una razón:
                            </p>
                            <select
                              className="w-full p-2 border rounded text-sm"
                              onChange={(e) => handleAttributeValueChange('EMPTY_GTIN_REASON', e.target.value)}
                              value={attributeValues['EMPTY_GTIN_REASON'] || ''}
                            >
                              <option value="">Seleccionar...</option>
                              {mlAttributes?.mlAttributes?.emptyReasons
                                .find((attr: MLAttribute) => attr.id === 'EMPTY_GTIN_REASON')
                                ?.values?.map((value: { id?: string; name: string }) => (
                                  <option key={value.id || value.name} value={value.id || ''}>
                                    {value.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Advertencia para EMPTY_GTIN_REASON inválido */}
              {hasInvalidEmptyGtinReason() && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    El valor de &quot;EMPTY_GTIN_REASON&quot; es inválido. Por favor, selecciona una razón válida de la lista desplegable en la sección de atributos condicionalmente requeridos.
                  </AlertDescription>
                </Alert>
              )}

              {/* Atributos actuales */}
              {attributes.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Atributos Configurados
                  </h4>
                  <div className="space-y-2">
                    {attributes.map((attr, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                        <div>
                          <span className="font-medium">{attr.name}</span>
                          <div className="text-sm text-muted-foreground">
                            {attr.values.join(', ')}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAttribute(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Eliminar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agregar atributo personalizado */}
              <div className="space-y-3">
                <h4 className="font-medium">Agregar Atributo Adicional</h4>
                <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700 dark:text-amber-300">
                    Usa esta sección solo para atributos no listados arriba. Los atributos obligatorios deben completarse en los campos específicos.
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre del atributo"
                    value={newAttribute.name}
                    onChange={(e) => setNewAttribute({ ...newAttribute, name: e.target.value })}
                  />
                  <Input
                    placeholder="Valor"
                    value={newAttribute.value}
                    onChange={(e) => setNewAttribute({ ...newAttribute, value: e.target.value })}
                  />
                  <Button 
                    type="button" 
                    onClick={() => {
                      if (newAttribute.name && newAttribute.value) {
                        const updatedAttributes = [...attributes, {
                          id: Date.now().toString(),
                          name: newAttribute.name.toUpperCase(),
                          values: [newAttribute.value]
                        } as DynamicAttribute & { id: string }];
                        onAttributesChange(updatedAttributes);
                        setNewAttribute({ name: '', value: '' });
                      }
                    }} 
                    disabled={!newAttribute.name || !newAttribute.value}
                  >
                    Agregar
                  </Button>
                </div>
              </div>

              {/* Guía adicional */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-medium">Consejos para atributos:</div>
                    <ul className="text-sm space-y-1">
                      <li>• <strong>GTIN:</strong> Usa el código de barras del producto (EAN, UPC, ISBN). Si no tiene, selecciona &quot;NO_GTIN&quot;</li>
                      <li>• <strong>Marca:</strong> Ingresa la marca exacta del producto</li>
                      <li>• <strong>Modelo:</strong> Especifica el modelo o número de parte</li>
                      <li>• Los atributos obligatorios son necesarios para poder sincronizar con Mercado Libre</li>
                    </ul>
                    <a 
                      href="https://vendedores.mercadolibre.com.ar/publicaciones" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm"
                    >
                      Ver guía completa de Mercado Libre
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>
      )}
    </div>
  );
}
