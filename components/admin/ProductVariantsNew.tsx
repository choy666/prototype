"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Edit3, Check, X, Package, Plus, Tag, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ImageManager } from "@/components/ui/ImageManager";

type MLAttributeDefinition = {
  id: string;
  name: string;
  values?: Array<{ id?: string; name: string }>;
  tags?: {
    allow_variations?: boolean;
  };
};

type NormalizedAttributeCombination = {
  id: string;
  name: string;
  value_name: string;
  value_id?: string;
};

export interface ProductVariant {
  id?: number;
  name?: string;
  description?: string;
  additionalAttributes: Record<string, string>;
  price?: string;
  stock: number;
  images?: string[];
  isActive: boolean;
  sku?: string;
  mlAttributeCombinations?: NormalizedAttributeCombination[];
  normalizationWarnings?: string[];
  errors?: string[];
}

interface ProductVariantsNewProps {
  productId: number;
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
  mlAttributes?: MLAttributeDefinition[];
  mlCategoryId?: string;
}



// Componente simple para atributos adicionales clave-valor
function AdditionalAttributesBuilder({
  attributes,
  onChange
}: {
  attributes: Record<string, string>;
  onChange: (attributes: Record<string, string>) => void;
}) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const addAttribute = () => {
    if (!newKey.trim() || !newValue.trim()) return;
    const updated = { ...attributes, [newKey.trim()]: newValue.trim() };
    onChange(updated);
    setNewKey("");
    setNewValue("");
  };

  const removeAttribute = (key: string) => {
    const updated = { ...attributes };
    delete updated[key];
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <Label>Atributos Adicionales Exclusivos</Label>
      <div className="space-y-2">
        {Object.entries(attributes).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2 p-2 bg-gray-900 rounded">
            <Tag className="h-4 w-4 text-blue-600" />
            <span className="font-medium">{key}:</span>
            <span>{value}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeAttribute(key)}
              className="ml-auto h-6 w-6 p-0 text-red-500 hover:text-red-700"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Nombre del atributo"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        <Input
          placeholder="Valor"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addAttribute}
        disabled={!newKey.trim() || !newValue.trim()}
      >
        <Plus className="h-3 w-3 mr-1" />
        Agregar Atributo
      </Button>
    </div>
  );
}

export function ProductVariantsNew({ productId, variants, onChange, mlAttributes = [], mlCategoryId }: ProductVariantsNewProps) {
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProductVariant>>({});
  const [newVariantForm, setNewVariantForm] = useState<Partial<ProductVariant>>({
    additionalAttributes: {},
    stock: 0,
    images: [],
    isActive: true,
    mlAttributeCombinations: [],
    normalizationWarnings: [],
  });
  const [variationAttributes, setVariationAttributes] = useState<MLAttributeDefinition[]>(mlAttributes);
  const [variationAttributesLoading, setVariationAttributesLoading] = useState(false);
  const [variationAttributesError, setVariationAttributesError] = useState<string | null>(null);

  useEffect(() => {
    if (!mlCategoryId) {
      setVariationAttributes(mlAttributes);
      setVariationAttributesError(null);
      return;
    }

    let cancelled = false;
    const fetchVariationAttributes = async () => {
      setVariationAttributesLoading(true);
      setVariationAttributesError(null);

      try {
        const response = await fetch(`/api/mercadolibre/categories/${mlCategoryId}/attributes?t=${Date.now()}`);
        if (!response.ok) {
          throw new Error('No se pudieron obtener los atributos de la categoría seleccionada');
        }

        const data = await response.json();
        const rawAttributes: MLAttributeDefinition[] =
          data?.mlAttributes?.all ??
          data?.rawAttributes ??
          data?.attributes ??
          mlAttributes;

        const allowVariationAttributes = rawAttributes.filter(
          (attr) => attr?.tags?.allow_variations
        );

        if (!cancelled) {
          setVariationAttributes(allowVariationAttributes);
          if (allowVariationAttributes.length === 0) {
            setVariationAttributesError('La categoría no expone atributos oficiales para variaciones.');
          }
        }
      } catch (error) {
        if (!cancelled) {
          setVariationAttributes([]);
          setVariationAttributesError(
            error instanceof Error
              ? error.message
              : 'No se pudieron obtener los atributos de variación'
          );
        }
      } finally {
        if (!cancelled) {
          setVariationAttributesLoading(false);
        }
      }
    };

    fetchVariationAttributes();

    return () => {
      cancelled = true;
    };
  }, [mlCategoryId, mlAttributes]);

  const normalizeVariantAttributes = useCallback(
    (additionalAttributes?: Record<string, string>) => {
      if (!additionalAttributes || Object.keys(additionalAttributes).length === 0) {
        return { mlAttributeCombinations: [], warnings: variationAttributes.length ? ['Debes definir al menos un atributo oficial para crear variaciones en ML.'] : [] };
      }

      const warnings: string[] = [];
      const combinations: NormalizedAttributeCombination[] = [];

      Object.entries(additionalAttributes).forEach(([key, value]) => {
        const cleanedKey = key.trim().toLowerCase();
        const attr = variationAttributes.find(
          (definition) =>
            definition.id.toLowerCase() === cleanedKey ||
            definition.name?.toLowerCase() === cleanedKey
        );

        if (!attr) {
          warnings.push(`"${key}" no corresponde a un atributo de variación oficial de Mercado Libre.`);
          return;
        }

        if (!value?.trim()) {
          warnings.push(`"${attr.name}" requiere un valor para sincronizar la variante.`);
          return;
        }

        const trimmedValue = value.trim();
        const loweredValue = trimmedValue.toLowerCase();
        const matchedValue = attr.values?.find(
          (option) =>
            option.name?.toLowerCase() === loweredValue || option.id?.toLowerCase() === loweredValue
        );

        combinations.push({
          id: attr.id,
          name: attr.name,
          value_name: matchedValue?.name ?? trimmedValue,
          value_id: matchedValue?.id,
        });

        if (!matchedValue && attr.values && attr.values.length > 0) {
          warnings.push(`El valor "${trimmedValue}" no coincide con los valores oficiales de ${attr.name}.`);
        }
      });

      const uniqueCombinations = combinations.filter(
        (combo, index, self) =>
          index === self.findIndex((other) => other.id === combo.id && other.value_name === combo.value_name)
      );

      if (uniqueCombinations.length > 2) {
        warnings.push('Mercado Libre recomienda un máximo de 2 atributos de variación (p. ej. Color y Talle).');
      }

      return {
        mlAttributeCombinations: uniqueCombinations,
        warnings,
      };
    },
    [variationAttributes]
  );

  const normalizedVariants = useMemo(
    () =>
      variants.map((variant) => {
        const { mlAttributeCombinations, warnings } = normalizeVariantAttributes(
          variant.additionalAttributes
        );

        return {
          ...variant,
          mlAttributeCombinations,
          normalizationWarnings: warnings,
        };
      }),
    [variants, normalizeVariantAttributes]
  );

  const handleNewVariantAttributesChange = useCallback(
    (attributes: Record<string, string>) => {
      const normalization = normalizeVariantAttributes(attributes);
      setNewVariantForm((prev) => ({
        ...prev,
        additionalAttributes: attributes,
        mlAttributeCombinations: normalization.mlAttributeCombinations,
        normalizationWarnings: normalization.warnings,
      }));
    },
    [normalizeVariantAttributes]
  );

  const handleEditVariantAttributesChange = useCallback(
    (attributes: Record<string, string>) => {
      const normalization = normalizeVariantAttributes(attributes);
      setEditForm((prev) => ({
        ...prev,
        additionalAttributes: attributes,
        mlAttributeCombinations: normalization.mlAttributeCombinations,
        normalizationWarnings: normalization.warnings,
      }));
    },
    [normalizeVariantAttributes]
  );

  // Cargar variantes existentes al montar
  useEffect(() => {
    const fetchVariants = async () => {
      try {
        const response = await fetch(`/api/admin/products/${productId}/variants`);
        if (response.ok) {
          const data = await response.json();
          onChange(data);
        }
      } catch (error) {
        console.error("Error al cargar variantes:", error);
      }
    };

    if (productId) {
      fetchVariants();
    }
  }, [productId, onChange]);

  const activeCount = variants.filter(v => v.isActive).length;
  const totalVariants = variants.length;
  const exceedsMlLimit = totalVariants > 60;
  const nearMlLimit = totalVariants >= 50 && totalVariants <= 60;
  const variantsWithoutAttrs = variants.filter(
    v => !v.additionalAttributes || Object.keys(v.additionalAttributes).length === 0
  ).length;

  const serializeAttrs = (attrs?: Record<string, string>) => {
    if (!attrs || Object.keys(attrs).length === 0) return "";
    return Object.entries(attrs)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join("|");
  };

  const combinationCounts: Record<string, number> = {};
  variants.forEach((variant) => {
    const key = serializeAttrs(variant.additionalAttributes);
    if (key) {
      combinationCounts[key] = (combinationCounts[key] || 0) + 1;
    }
  });

  const handleCreateVariant = async () => {
    // Validación de campos obligatorios
    if (!newVariantForm.name?.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la variante es obligatorio",
        variant: "destructive",
      });
      return;
    }

    if (!newVariantForm.price || parseFloat(newVariantForm.price) <= 0) {
      toast({
        title: "Error",
        description: "El precio específico es obligatorio y debe ser mayor a 0",
        variant: "destructive",
      });
      return;
    }

    if (!newVariantForm.images || newVariantForm.images.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos una imagen",
        variant: "destructive",
      });
      return;
    }

    // Validación UI extra: evitar combinaciones duplicadas de atributos adicionales
    const newAttrsKey = serializeAttrs(newVariantForm.additionalAttributes || {});
    if (newAttrsKey) {
      const existsDuplicate = variants.some(
        (v) => serializeAttrs(v.additionalAttributes) === newAttrsKey
      );
      if (existsDuplicate) {
        toast({
          title: "Atributos duplicados",
          description:
            "Ya existe una variante con estos atributos adicionales. Mercado Libre requiere combinaciones únicas por variante.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const response = await fetch(`/api/admin/products/${productId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newVariantForm),
      });

      if (response.ok) {
        const newVariant = await response.json();
        const normalization = normalizeVariantAttributes(newVariant.additionalAttributes || {});
        const variantWithNormalization = {
          ...newVariant,
          mlAttributeCombinations: normalization.mlAttributeCombinations,
          normalizationWarnings: normalization.warnings,
        };
        onChange([...variants, variantWithNormalization]);
        setNewVariantForm({
          additionalAttributes: {},
          stock: 0,
          images: [],
          isActive: true,
          mlAttributeCombinations: [],
          normalizationWarnings: [],
        });
        setShowCreateForm(false);
        toast({
          title: "Variante creada",
          description: "La variante ha sido creada exitosamente",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "No se pudo crear la variante",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al crear variante:", error);
      toast({
        title: "Error",
        description: "Error interno del servidor",
        variant: "destructive",
      });
    }
  };

  const handleEditVariant = (index: number) => {
    setEditingVariant(index);
    const variant = variants[index];
    const normalization = normalizeVariantAttributes(variant.additionalAttributes || {});
    setEditForm({
      ...variant,
      name: variant.name ?? undefined,
      description: variant.description ?? undefined,
      price: variant.price ?? undefined,
      additionalAttributes: variant.additionalAttributes ?? undefined,
      images: variant.images ?? undefined,
      mlAttributeCombinations:
        variant.mlAttributeCombinations && variant.mlAttributeCombinations.length > 0
          ? variant.mlAttributeCombinations
          : normalization.mlAttributeCombinations,
      normalizationWarnings:
        variant.normalizationWarnings && variant.normalizationWarnings.length > 0
          ? variant.normalizationWarnings
          : normalization.warnings,
    });
  };

  const handleSaveEdit = async () => {
    if (editingVariant === null) return;

    try {
      const variant = variants[editingVariant];
      const response = await fetch(`/api/admin/products/${productId}/variants?variantId=${variant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        const updatedVariant = await response.json();
        const updatedVariants = [...variants];
        updatedVariants[editingVariant] = updatedVariant;
        onChange(updatedVariants);
        setEditingVariant(null);
        setEditForm({});
        toast({
          title: "Variante actualizada",
          description: "Los cambios han sido guardados",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "No se pudo actualizar la variante",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al actualizar variante:", error);
      toast({
        title: "Error",
        description: "Error interno del servidor",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingVariant(null);
    setEditForm({});
  };

  const handleDeleteVariant = async (index: number) => {
    const variant = variants[index];
    if (!variant.id) return;

    try {
      const response = await fetch(`/api/admin/products/${productId}/variants?variantId=${variant.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const updatedVariants = variants.filter((_, i) => i !== index);
        onChange(updatedVariants);
        toast({
          title: "Variante eliminada",
          description: "La variante ha sido eliminada",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "No se pudo eliminar la variante",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error al eliminar variante:", error);
      toast({
        title: "Error",
        description: "Error interno del servidor",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (index: number) => {
    const variant = variants[index];
    if (!variant.id) return;

    const updatedIsActive = !variant.isActive;

    try {
      const response = await fetch(`/api/admin/products/${productId}/variants?variantId=${variant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: updatedIsActive }),
      });

      if (response.ok) {
        const updatedVariants = [...variants];
        updatedVariants[index].isActive = updatedIsActive;
        onChange(updatedVariants);
      }
    } catch (error) {
      console.error("Error al cambiar estado de variante:", error);
    }
  };



  const formatAdditionalAttributes = (attrs?: Record<string, string>) => {
    if (!attrs || Object.keys(attrs).length === 0) return null;
    return Object.entries(attrs)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Variantes del Producto</h3>
          <p className="text-sm text-muted-foreground">
            Crea y gestiona variantes personalizadas del producto
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {activeCount} activas
          </Badge>
          <Badge variant={exceedsMlLimit ? "destructive" : "secondary"}>
            ML: {totalVariants}/60 variantes
          </Badge>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar Variante
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-muted/30 bg-muted/5 px-3 py-2 text-sm">
        {variationAttributesLoading ? (
          <div className="text-muted-foreground">Cargando atributos de variación oficiales…</div>
        ) : variationAttributesError ? (
          <div className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>{variationAttributesError}</span>
          </div>
        ) : variationAttributes.length > 0 ? (
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">Atributos disponibles:</span>{" "}
            {variationAttributes.map((attr) => attr.name).join(", ")}
          </div>
        ) : (
          <div className="flex items-start gap-2 text-amber-700">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>Esta categoría no expone atributos de variación oficiales. Agrega atributos manualmente y revisa las advertencias.</span>
          </div>
        )}
      </div>

      {/* Recomendaciones de Mercado Libre para variantes */}
      {exceedsMlLimit && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Mercado Libre permite máximo 60 variantes por publicación. Actualmente tienes {totalVariants}.
          Reduce la cantidad de variantes o combina atributos para cumplir con el límite.
        </div>
      )}
      {!exceedsMlLimit && nearMlLimit && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Estás cerca del límite de 60 variantes de Mercado Libre ({totalVariants}/60). Revisa si todas son necesarias.
        </div>
      )}
      {!exceedsMlLimit && variantsWithoutAttrs > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Hay {variantsWithoutAttrs} variantes sin atributos adicionales. Para Mercado Libre se recomienda que cada
          variante tenga atributos únicos (por ejemplo, Color, Talla) para poder diferenciarlas.
        </div>
      )}

      {/* Formulario de creación */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nueva Variante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="variant-name">Nombre de la Variante *</Label>
                <Input
                  id="variant-name"
                  value={newVariantForm.name || ""}
                  onChange={(e) => setNewVariantForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Versión Premium"
                  required
                />
              </div>
              <div>
                <Label htmlFor="variant-price">Precio Específico *</Label>
                <Input
                  id="variant-price"
                  type="number"
                  step="0.01"
                  value={newVariantForm.price || ""}
                  onChange={(e) => setNewVariantForm(prev => ({
                    ...prev,
                    price: e.target.value || undefined
                  }))}
                  placeholder="Precio específico de la variante"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="variant-description">Descripción (opcional)</Label>
              <Textarea
                id="variant-description"
                value={newVariantForm.description || ""}
                onChange={(e) => setNewVariantForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción específica de esta variante"
                rows={3}
              />
            </div>



            <AdditionalAttributesBuilder
              attributes={newVariantForm.additionalAttributes || {}}
              onChange={handleNewVariantAttributesChange}
            />

            {(newVariantForm.mlAttributeCombinations?.length ?? 0) > 0 && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="font-medium mb-1">Combinaciones oficiales a enviar:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {newVariantForm.mlAttributeCombinations?.map((combo) => (
                    <li key={combo.id}>
                      {combo.name}: <span className="font-semibold">{combo.value_name}</span>
                      {combo.value_id ? ` (ID ${combo.value_id})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(newVariantForm.normalizationWarnings?.length ?? 0) > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Advertencias de normalización
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {newVariantForm.normalizationWarnings?.map((warning, idx) => (
                    <li key={`new-warning-${idx}`}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <Label htmlFor="variant-images">Imágenes *</Label>
              <ImageManager
                mode="reorder"
                images={newVariantForm.images || []}
                onImagesChange={(images) => setNewVariantForm(prev => ({ ...prev, images }))}
                maxImages={10}
              />
            </div>

            <div>
              <Label htmlFor="variant-stock">Stock Inicial</Label>
              <Input
                id="variant-stock"
                type="number"
                min="0"
                value={newVariantForm.stock || 0}
                onChange={(e) => setNewVariantForm(prev => ({
                  ...prev,
                  stock: parseInt(e.target.value) || 0
                }))}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="variant-active"
                checked={newVariantForm.isActive ?? true}
                onCheckedChange={(checked) => setNewVariantForm(prev => ({
                  ...prev,
                  isActive: !!checked
                }))}
              />
              <Label htmlFor="variant-active">Activa</Label>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreateVariant}>
                <Check className="h-4 w-4 mr-2" />
                Crear Variante
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de variantes */}
      <div className="grid gap-4">
        {normalizedVariants.map((variant, index) => {
          const originalVariant = variants[index];
          return (
          <Card key={variant.id || originalVariant?.id || index} className={`transition-all ${!variant.isActive ? 'opacity-60' : ''}`}>
            <CardContent className="p-4">
              {editingVariant === index ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Editando variante</h4>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveEdit}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nombre (opcional)</Label>
                      <Input
                        value={editForm.name || ""}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Nombre de la variante"
                      />
                    </div>
                    <div>
                      <Label>Precio específico (opcional)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.price || ""}
                        onChange={(e) => setEditForm(prev => ({
                          ...prev,
                          price: e.target.value ? e.target.value : undefined
                        }))}
                        placeholder="Deja vacío para usar precio base"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Descripción (opcional)</Label>
                    <Textarea
                      value={editForm.description || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descripción específica"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Stock</Label>
                    <p className="text-sm text-gray-600 mt-1">{editForm.stock || 0} unidades</p>
                  </div>



                  <AdditionalAttributesBuilder
                    attributes={editForm.additionalAttributes || {}}
                    onChange={handleEditVariantAttributesChange}
                  />

                  {(editForm.mlAttributeCombinations?.length ?? 0) > 0 && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                      <p className="font-medium mb-1">Combinaciones oficiales a enviar:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {editForm.mlAttributeCombinations?.map((combo) => (
                          <li key={`edit-combo-${combo.id}`}>
                            {combo.name}: <span className="font-semibold">{combo.value_name}</span>
                            {combo.value_id ? ` (ID ${combo.value_id})` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(editForm.normalizationWarnings?.length ?? 0) > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 space-y-1">
                      <div className="flex items-center gap-2 font-medium">
                        <AlertTriangle className="h-4 w-4" />
                        Advertencias de normalización
                      </div>
                      <ul className="list-disc pl-5 space-y-1">
                        {editForm.normalizationWarnings?.map((warning, idx) => (
                          <li key={`edit-warning-${idx}`}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-active-${index}`}
                      checked={editForm.isActive ?? true}
                      onCheckedChange={(checked) => setEditForm(prev => ({
                        ...prev,
                        isActive: !!checked
                      }))}
                    />
                    <Label htmlFor={`edit-active-${index}`}>Activa</Label>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">
                        {variant.name || formatAdditionalAttributes(variant.additionalAttributes)}
                      </h4>
                      <Badge variant={variant.isActive ? "default" : "secondary"}>
                        {variant.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                      {(() => {
                        const key = serializeAttrs(variant.additionalAttributes);
                        const hasAttrs = !!key;
                        const isDuplicate = key && combinationCounts[key] > 1;

                        if (!hasAttrs) {
                          return (
                            <Badge variant="destructive" className="text-[10px]">
                              Sin atributos
                            </Badge>
                          );
                        }

                        if (isDuplicate) {
                          return (
                            <Badge variant="destructive" className="text-[10px]">
                              Combinación duplicada
                            </Badge>
                          );
                        }

                        return (
                          <Badge variant="outline" className="text-[10px]">
                            Atributos OK
                          </Badge>
                        );
                      })()}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Stock: {variant.stock} unidades</p>
                      {variant.price && <p>Precio: ${variant.price}</p>}
                      {variant.description && <p>Descripción: {variant.description}</p>}
                      {formatAdditionalAttributes(variant.additionalAttributes) && (
                        <p>Atributos adicionales: {formatAdditionalAttributes(variant.additionalAttributes)}</p>
                      )}
                      {(variant.mlAttributeCombinations?.length ?? 0) > 0 && (
                        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                          <p className="font-medium mb-1">Combinaciones oficiales</p>
                          <ul className="list-disc pl-5 space-y-1">
                            {variant.mlAttributeCombinations?.map((combo) => (
                              <li key={`list-combo-${variant.id}-${combo.id}`}>
                                {combo.name}: <span className="font-semibold">{combo.value_name}</span>
                                {combo.value_id ? ` (ID ${combo.value_id})` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(variant.normalizationWarnings?.length ?? 0) > 0 && (
                        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 space-y-1">
                          <div className="flex items-center gap-2 font-medium">
                            <AlertTriangle className="h-4 w-4" />
                            Advertencias de normalización
                          </div>
                          <ul className="list-disc pl-5 space-y-1">
                            {variant.normalizationWarnings?.map((warning, idx) => (
                              <li key={`list-warning-${variant.id}-${idx}`}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEditVariant(index)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleActive(index)}>
                      {variant.isActive ? "Desactivar" : "Activar"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteVariant(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )})}
      </div>

      {variants.length === 0 && !showCreateForm && (
        <div className="text-center py-8 text-gray-500">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No hay variantes creadas. Haz clic en &apos;Agregar Variante&apos; para crear la primera.</p>
        </div>
      )}
    </div>
  );
}
