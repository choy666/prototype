'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, Barcode, Package, Tag, AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DynamicAttribute } from '@/components/admin/AttributeBuilder';

interface MLAttribute {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  values?: Array<{
    id: string;
    name: string;
  }>;
  tags?: string[];
  help_value?: string;
  allowed_units?: string[];
  max_length?: number;
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
  const [mlAttributes, setMlAttributes] = useState<MLAttribute[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [newAttribute, setNewAttribute] = useState({ name: '', value: '' });

  // Cargar atributos de la categoría ML
  useEffect(() => {
    if (!categoryId) {
      setMlAttributes([]);
      return;
    }

    const fetchAttributes = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/mercadolibre/categories/${categoryId}/attributes`);
        if (response.ok) {
          const data = await response.json();
          setMlAttributes(data.attributes || []);
        }
      } catch (error) {
        console.error('Error cargando atributos ML:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttributes();
  }, [categoryId]);

  // Obtener atributos requeridos faltantes
  const getMissingRequiredAttributes = () => {
    const requiredAttrs = mlAttributes.filter(attr => attr.required);
    return requiredAttrs.filter(required => 
      !attributes.some(existing => 
        existing.name.toLowerCase() === required.name.toLowerCase() ||
        (required.tags?.includes('gtin') && 
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
    return mlAttributes.filter(attr => 
      !attr.required && 
      attr.tags?.includes('catalog_required')
    );
  };

  // Agregar un atributo
  const handleAddAttribute = () => {
    if (newAttribute.name && newAttribute.value) {
      const updatedAttributes = [...attributes, {
        id: Date.now().toString(),
        name: newAttribute.name,
        values: [newAttribute.value]
      } as DynamicAttribute & { id: string }];
      onAttributesChange(updatedAttributes);
      setNewAttribute({ name: '', value: '' });
    }
  };

  // Eliminar un atributo
  const handleRemoveAttribute = (index: number) => {
    const updatedAttributes = attributes.filter((_, i) => i !== index);
    onAttributesChange(updatedAttributes);
  };


  const missingRequired = getMissingRequiredAttributes();
  const recommended = getRecommendedAttributes();
  const hasErrors = missingRequired.length > 0 && showValidationErrors;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Atributos de Mercado Libre</h3>
          <Badge variant="secondary" className="text-xs">
            {mlAttributes.length} disponibles
          </Badge>
        </div>
        <Button
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
                      {missingRequired.map((attr, index) => (
                        <div key={index} className="text-sm">
                          • <strong>{attr.name}</strong>
                          {attr.tags?.includes('gtin') && (
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
                      Atributos Obligatorios Faltantes
                    </h4>
                  </div>
                  <div className="grid gap-3">
                    {missingRequired.map((attr) => (
                      <div key={attr.id} className="p-3 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <Label className="font-medium flex items-center gap-2">
                              {attr.name}
                              {attr.tags?.includes('gtin') && <Barcode className="h-4 w-4" />}
                              <Badge variant="destructive" className="text-xs">Requerido</Badge>
                            </Label>
                            
                            {/* GTIN especial */}
                            {attr.tags?.includes('gtin') ? (
                              <div className="space-y-2">
                                <Select onValueChange={(value) => {
                                  const updatedAttributes = [...attributes, {
                                    id: Date.now().toString(),
                                    name: attr.name,
                                    values: [value]
                                  } as DynamicAttribute & { id: string }];
                                  onAttributesChange(updatedAttributes);
                                }}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecciona una opción" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {attr.values?.map((value) => (
                                      <SelectItem key={value.id} value={value.name}>
                                        {value.name} {value.id === 'NO_GTIN' && '(sin código de barras)'}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {attr.help_value && (
                                  <p className="text-xs text-muted-foreground">{attr.help_value}</p>
                                )}
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Input
                                  placeholder={`Ingresa ${attr.name.toLowerCase()}`}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const value = (e.target as HTMLInputElement).value;
                                      if (value) {
                                        const updatedAttributes = [...attributes, {
                                          id: Date.now().toString(),
                                          name: attr.name,
                                          values: [value]
                                        } as DynamicAttribute & { id: string }];
                                        onAttributesChange(updatedAttributes);
                                      }
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const input = document.querySelector(`input[placeholder="Ingresa ${attr.name.toLowerCase()}"]`) as HTMLInputElement;
                                    const value = input?.value;
                                    if (value) {
                                      const updatedAttributes = [...attributes, {
                                        id: Date.now().toString(),
                                        name: attr.name,
                                        values: [value]
                                      } as DynamicAttribute & { id: string }];
                                      onAttributesChange(updatedAttributes);
                                      input.value = '';
                                    }
                                  }}
                                >
                                  Agregar
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
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
                  <div className="grid gap-2">
                    {recommended.slice(0, 3).map((attr) => (
                      <div key={attr.id} className="flex items-center justify-between p-2 border rounded-lg">
                        <span className="text-sm">{attr.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNewAttribute({ name: attr.name, value: '' });
                          }}
                        >
                          Agregar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
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
                  <Button onClick={handleAddAttribute} disabled={!newAttribute.name || !newAttribute.value}>
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
