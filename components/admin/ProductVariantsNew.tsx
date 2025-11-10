"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Edit3, Check, X, Package, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ImageReorder } from "@/components/ui/ImageReorder";


export interface ProductVariant {
  id?: number;
  name?: string;
  description?: string;
  attributes: Record<string, string>;
  additionalAttributes?: Record<string, string>;
  price?: number;
  stock: number;
  images?: string[];
  isActive: boolean;
}

interface ProductVariantsNewProps {
  productId: number;
  parentAttributes: Record<string, string>; // Atributos heredados del padre
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
}

export function ProductVariantsNew({ productId, parentAttributes, variants, onChange }: ProductVariantsNewProps) {
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProductVariant>>({});
  const [newVariantForm, setNewVariantForm] = useState<Partial<ProductVariant>>({
    attributes: parentAttributes,
    stock: 0,
    images: [],
    isActive: true,
  });

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

    if (!newVariantForm.price || newVariantForm.price <= 0) {
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

    try {
      const response = await fetch(`/api/admin/products/${productId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newVariantForm),
      });

      if (response.ok) {
        const newVariant = await response.json();
        onChange([...variants, newVariant]);
        setNewVariantForm({
          attributes: parentAttributes,
          stock: 0,
          images: [],
          isActive: true,
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
    setEditForm({ ...variants[index] });
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

  const formatAttributes = (attrs: Record<string, string>) => {
    return Object.entries(attrs)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
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
            {variants.filter(v => v.isActive).length} activas
          </Badge>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar Variante
          </Button>
        </div>
      </div>

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
                    price: e.target.value ? parseFloat(e.target.value) : undefined
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

            <div>
              <Label>Atributos Heredados del Padre</Label>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm">{formatAttributes(parentAttributes)}</p>
              </div>
            </div>

            <div>
              <Label htmlFor="variant-images">Imágenes *</Label>
              <ImageReorder
                images={newVariantForm.images || []}
                onReorder={(images) => setNewVariantForm(prev => ({ ...prev, images }))}
                onRemove={(index) => setNewVariantForm(prev => ({
                  ...prev,
                  images: prev.images?.filter((_, i) => i !== index) || []
                }))}
                onAdd={(imageUrl) => setNewVariantForm(prev => ({
                  ...prev,
                  images: [...(prev.images || []), imageUrl]
                }))}
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
        {variants.map((variant, index) => (
          <Card key={variant.id || index} className={`transition-all ${!variant.isActive ? 'opacity-60' : ''}`}>
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
                          price: e.target.value ? parseFloat(e.target.value) : undefined
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
                    <Input
                      type="number"
                      value={editForm.stock || 0}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        stock: parseInt(e.target.value) || 0
                      }))}
                    />
                  </div>

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
                        {variant.name || formatAttributes(variant.attributes)}
                      </h4>
                      <Badge variant={variant.isActive ? "default" : "secondary"}>
                        {variant.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Stock: {variant.stock} unidades</p>
                      {variant.price && <p>Precio: ${variant.price}</p>}
                      {variant.description && <p>Descripción: {variant.description}</p>}
                      {formatAdditionalAttributes(variant.additionalAttributes) && (
                        <p>Atributos adicionales: {formatAdditionalAttributes(variant.additionalAttributes)}</p>
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
        ))}
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
