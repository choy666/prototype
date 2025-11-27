'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';

interface AttributeValueForm {
  name: string;
  mlValueId: string;
}

interface AttributeForm {
  name: string;
  mlAttributeId: string;
  values: AttributeValueForm[];
}

export default function NewProductAttributePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<AttributeForm>({
    name: '',
    mlAttributeId: '',
    values: [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name: form.name,
        mlAttributeId: form.mlAttributeId || undefined,
        values: form.values.map((v) => ({
          name: v.name,
          mlValueId: v.mlValueId || undefined,
        })),
      };

      const response = await fetch('/api/admin/product-attributes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create product attribute');
      }

      toast({
        title: 'Éxito',
        description: 'Atributo creado correctamente',
      });

      router.push('/admin/product-attributes');
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'No se pudo crear el atributo de producto',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof AttributeForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleValueChange = (index: number, field: keyof AttributeValueForm, value: string) => {
    setForm((prev) => {
      const values = [...prev.values];
      values[index] = { ...values[index], [field]: value };
      return { ...prev, values };
    });
  };

  const handleAddValue = () => {
    setForm((prev) => ({
      ...prev,
      values: [...prev.values, { name: '', mlValueId: '' }],
    }));
  };

  const handleRemoveValue = (index: number) => {
    setForm((prev) => ({
      ...prev,
      values: prev.values.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/admin/product-attributes">
          <Button variant="outline" size="sm" className="w-full sm:w-auto min-h-[44px]">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Nuevo atributo de producto
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Define un atributo base (por ejemplo, Color) y sus posibles valores de catálogo ML.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información del atributo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Ej: Color, Talla, Material"
                required
              />
            </div>

            <div>
              <Label htmlFor="mlAttributeId">ID de atributo en Mercado Libre</Label>
              <Input
                id="mlAttributeId"
                value={form.mlAttributeId}
                onChange={(e) => handleChange('mlAttributeId', e.target.value)}
                placeholder="Ej: COLOR, SIZE, BRAND"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Este es el ID del atributo en el catálogo de Mercado Libre (por ejemplo, COLOR, BRAND).
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Valores de catálogo</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddValue}
                  className="min-h-[32px]"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Agregar valor
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Define los valores permitidos para este atributo en el catálogo de ML (por ejemplo, Negro,
                Blanco, Rojo) y sus IDs de valor.
              </p>

              {form.values.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aún no hay valores definidos. Puedes dejarlos vacíos y configurarlos más tarde.
                </p>
              ) : (
                <div className="space-y-3">
                  {form.values.map((value, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-[1.5fr_1.5fr_auto] gap-2 items-end"
                    >
                      <div>
                        <Label htmlFor={`value-name-${index}`}>Nombre</Label>
                        <Input
                          id={`value-name-${index}`}
                          value={value.name}
                          onChange={(e) => handleValueChange(index, 'name', e.target.value)}
                          placeholder="Ej: Negro"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`value-mlValueId-${index}`}>ID de valor ML</Label>
                        <Input
                          id={`value-mlValueId-${index}`}
                          value={value.mlValueId}
                          onChange={(e) => handleValueChange(index, 'mlValueId', e.target.value)}
                          placeholder="Ej: 52049"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => handleRemoveValue(index)}
                          className="h-9 w-9"
                          aria-label="Eliminar valor"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-4">
              <Link href="/admin/product-attributes">
                <Button type="button" variant="outline" className="w-full sm:w-auto min-h-[44px]">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto min-h-[44px]">
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Creando...' : 'Crear atributo'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
