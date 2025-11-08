"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Edit3, Check, X, Package } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { DynamicAttribute } from "./AttributeBuilder";

export interface ProductVariant {
  id?: number;
  attributes: Record<string, string>;
  price?: number;
  stock: number;
  images?: string[];
  isActive: boolean;
}

interface ProductVariantsNewProps {
  attributes: DynamicAttribute[];
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
}

export function ProductVariantsNew({ attributes, variants, onChange }: ProductVariantsNewProps) {
  const { toast } = useToast();
  const [generatedVariants, setGeneratedVariants] = useState<ProductVariant[]>([]);
  const [editingVariant, setEditingVariant] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProductVariant>>({});

  // Generar combinaciones cartesianas de atributos
  const generateCombinations = (attrs: DynamicAttribute[]): Record<string, string>[] => {
    if (attrs.length === 0) return [];

    const combinations: Record<string, string>[] = [{}];

    for (const attr of attrs) {
      const newCombinations: Record<string, string>[] = [];
      for (const combo of combinations) {
        for (const value of attr.values) {
          newCombinations.push({ ...combo, [attr.name]: value });
        }
      }
      combinations.splice(0, combinations.length, ...newCombinations);
    }

    return combinations;
  };

  // Generar variantes automáticamente cuando cambian los atributos
  useEffect(() => {
    const combinations = generateCombinations(attributes);
    const newVariants: ProductVariant[] = combinations.map((combo) => {
      // Buscar si ya existe una variante con estos atributos
      const existing = variants.find(v =>
        JSON.stringify(v.attributes) === JSON.stringify(combo)
      );

      return existing || {
        attributes: combo,
        stock: 0,
        isActive: true,
      };
    });

    setGeneratedVariants(newVariants);
    onChange(newVariants);
  }, [attributes, variants, onChange]);

  // Actualizar variantes cuando cambian las generadas
  useEffect(() => {
    onChange(generatedVariants);
  }, [generatedVariants, onChange]);

  const handleEditVariant = (index: number) => {
    setEditingVariant(index);
    setEditForm({ ...generatedVariants[index] });
  };

  const handleSaveEdit = () => {
    if (editingVariant === null) return;

    const updatedVariants = [...generatedVariants];
    updatedVariants[editingVariant] = {
      ...updatedVariants[editingVariant],
      ...editForm,
    };

    setGeneratedVariants(updatedVariants);
    setEditingVariant(null);
    setEditForm({});

    toast({
      title: "Variante actualizada",
      description: "Los cambios han sido guardados",
    });
  };

  const handleCancelEdit = () => {
    setEditingVariant(null);
    setEditForm({});
  };

  const handleDeleteVariant = (index: number) => {
    const updatedVariants = generatedVariants.filter((_, i) => i !== index);
    setGeneratedVariants(updatedVariants);

    toast({
      title: "Variante eliminada",
      description: "La variante ha sido eliminada",
    });
  };

  const handleToggleActive = (index: number) => {
    const updatedVariants = [...generatedVariants];
    updatedVariants[index].isActive = !updatedVariants[index].isActive;
    setGeneratedVariants(updatedVariants);
  };

  const formatAttributes = (attrs: Record<string, string>) => {
    return Object.entries(attrs)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
  };

  if (attributes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Agrega atributos dinámicos para generar variantes automáticamente</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Variantes Generadas ({generatedVariants.length})
        </h3>
        <Badge variant="outline">
          {generatedVariants.filter(v => v.isActive).length} activas
        </Badge>
      </div>

      <div className="grid gap-4">
        {generatedVariants.map((variant, index) => (
          <Card key={index} className={`transition-all ${!variant.isActive ? 'opacity-60' : ''}`}>
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

                  <div className="grid grid-cols-2 gap-4">
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
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`active-${index}`}
                      checked={editForm.isActive ?? true}
                      onCheckedChange={(checked) => setEditForm(prev => ({
                        ...prev,
                        isActive: !!checked
                      }))}
                    />
                    <Label htmlFor={`active-${index}`}>Activa</Label>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">{formatAttributes(variant.attributes)}</h4>
                      <Badge variant={variant.isActive ? "default" : "secondary"}>
                        {variant.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Stock: {variant.stock} unidades</p>
                      {variant.price && <p>Precio: ${variant.price}</p>}
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

      {generatedVariants.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No se pudieron generar variantes. Verifica los atributos.</p>
        </div>
      )}
    </div>
  );
}
