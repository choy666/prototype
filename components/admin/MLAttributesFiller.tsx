'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';


interface Product {
  id: number;
  name: string;
  mlCategoryId: string;
  attributes: Record<string, unknown>;
}

interface MLAttributesFillerProps {
  productId: number;
  onAttributesUpdated?: () => void;
  onCancel?: () => void;
}

export function MLAttributesFiller({ productId, onAttributesUpdated, onCancel }: MLAttributesFillerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<{
    name: string;
    totalAttributes: number;
    requiredAttributes: string[];
    conditionalAttributes: string[];
    requiredAttributesDetails?: Array<{ id: string; tags: string[]; valueType?: string; values?: Array<{ name: string }> }>;
    conditionalAttributesDetails?: Array<{ id: string; tags: string[]; valueType?: string; values?: Array<{ name: string }> }>;
  } | null>(null);
  const [validation, setValidation] = useState<{
    isValid: boolean;
    missingAttributes: string[];
    conditionalAttributes: string[];
    warnings: string[];
  } | null>(null);
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAttributesData = async () => {
      try {
        const response = await fetch(`/api/admin/products/debug-attributes?productId=${productId}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Error al cargar datos');
          return;
        }

        setProduct(data.product);
        setCategory(data.category);
        setValidation(data.validation);

        // Inicializar valores con los atributos existentes
        const initialValues: Record<string, string> = {};
        data.missingAttributes?.forEach((attrId: string) => {
          initialValues[attrId] = data.product.currentAttributes[attrId] || '';
        });
        setAttributeValues(initialValues);
      } catch {
        setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    };

    fetchAttributesData();
  }, [productId]);

  const handleAttributeChange = (attributeId: string, value: string) => {
    setAttributeValues(prev => ({
      ...prev,
      [attributeId]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Combinar atributos existentes con los nuevos
      const updatedAttributes = {
        ...product?.attributes,
        ...attributeValues
      };

      const response = await fetch(`/api/admin/products/${productId}/attributes`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attributes: updatedAttributes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al guardar atributos');
        return;
      }

      // Validar nuevamente
      const validationResponse = await fetch(`/api/admin/products/debug-attributes?productId=${productId}`);
      const validationData = await validationResponse.json();

      if (validationData.validation.isValid) {
        onAttributesUpdated?.();
      } else {
        // Actualizar estado con los atributos que faltan
        setValidation(validationData.validation);
        setError('Aún faltan atributos requeridos');
      }
    } catch {
      console.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const getAttributeInfo = (attributeId: string) => {
    return category?.requiredAttributesDetails?.find((attr) => attr.id === attributeId) ||
           category?.conditionalAttributesDetails?.find((attr) => attr.id === attributeId);
  };

  const renderAttributeInput = (attributeId: string) => {
    const attrInfo = getAttributeInfo(attributeId);
    const currentValue = attributeValues[attributeId] || '';

    if (attributeId === 'GTIN') {
      return (
        <div className="space-y-2">
          <Label htmlFor={attributeId} className="flex items-center gap-2">
            {attributeId}
            <Badge variant="outline">Código de barras</Badge>
          </Label>
          <div className="flex gap-2">
            <Input
              id={attributeId}
              value={currentValue}
              onChange={(e) => handleAttributeChange(attributeId, e.target.value)}
              placeholder="EAN, UPC, ISBN..."
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAttributeChange('GTIN_TYPE', 'NO_GTIN')}
            >
              Sin GTIN
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Si el producto no tiene código de barras, haga clic en &quot;Sin GTIN&quot;
          </p>
        </div>
      );
    }

    if (attrInfo?.valueType === 'list' && attrInfo?.values) {
      return (
        <div className="space-y-2">
          <Label htmlFor={attributeId}>{attributeId}</Label>
          <Select value={currentValue} onValueChange={(value) => handleAttributeChange(attributeId, value)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccione una opción" />
            </SelectTrigger>
            <SelectContent>
              {attrInfo.values.map((value: { id?: string; name: string }) => (
                <SelectItem key={value.id || value.name} value={value.name}>
                  {value.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Label htmlFor={attributeId}>{attributeId}</Label>
        <Input
          id={attributeId}
          value={currentValue}
          onChange={(e) => handleAttributeChange(attributeId, e.target.value)}
          placeholder={`Ingrese ${attributeId.toLowerCase()}`}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error && !product) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const hasMissingRequired = (validation?.missingAttributes?.length ?? 0) > 0;
  const hasMissingConditional = (validation?.conditionalAttributes?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Completar Atributos de Mercado Libre</h2>
        <p className="text-muted-foreground">
          Producto: {product?.name} | Categoría: {category?.name}
        </p>
      </div>

      {hasMissingRequired && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Atributos Requeridos Faltantes
            </CardTitle>
            <CardDescription>
              Estos atributos son obligatorios para publicar en esta categoría
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {validation?.missingAttributes?.map((attrId: string) => (
              <div key={attrId}>
                {renderAttributeInput(attrId)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {hasMissingConditional && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Atributos Condicionales
            </CardTitle>
            <CardDescription>
              Estos atributos pueden ser necesarios dependiendo de otras características
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {validation?.conditionalAttributes?.map((attrId: string) => (
              <div key={attrId}>
                {renderAttributeInput(attrId)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(validation?.warnings?.length ?? 0) > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {validation?.warnings?.map((warning: string, index: number) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving || (!hasMissingRequired && !hasMissingConditional)}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Guardar Atributos
            </>
          )}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button variant="ghost" asChild>
          <a
            href="https://www.mercadolibre.com.ar/ayuda/atributos-productos_3437"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Guía de Atributos
          </a>
        </Button>
      </div>
    </div>
  );
}
