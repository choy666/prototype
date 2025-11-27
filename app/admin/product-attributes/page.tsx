'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Plus, Edit, Trash2, Search, Tag } from 'lucide-react';

interface AttributeValue {
  name?: string;
  mlValueId?: string;
}

interface ProductAttribute {
  id: number;
  name: string;
  mlAttributeId?: string | null;
  values: AttributeValue[];
  created_at: string;
  updated_at: string;
}

export default function AdminProductAttributesPage() {
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    attributeId: number | null;
  }>({
    isOpen: false,
    attributeId: null,
  });
  const { toast } = useToast();

  const fetchAttributes = useCallback(
    async (searchTerm = '') => {
      try {
        setLoading(true);
        const params = new URLSearchParams({});
        if (searchTerm) {
          params.set('search', searchTerm);
        }

        const response = await fetch(`/api/admin/product-attributes?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch product attributes');
        const data: ProductAttribute[] = await response.json();
        setAttributes(data);
      } catch {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los atributos de producto',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    fetchAttributes();
  }, [fetchAttributes]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAttributes(search);
  };

  const handleDeleteClick = (id: number) => {
    setDeleteDialog({ isOpen: true, attributeId: id });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.attributeId) return;

    try {
      const response = await fetch(`/api/admin/product-attributes/${deleteDialog.attributeId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete product attribute');

      toast({
        title: 'Éxito',
        description: 'Atributo eliminado correctamente',
      });
      fetchAttributes(search);
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el atributo',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialog({ isOpen: false, attributeId: null });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ isOpen: false, attributeId: null });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Atributos de producto (catálogo ML)
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gestiona los atributos base que se mapean al catálogo de Mercado Libre (Color, Talla, etc.).
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href="/admin/product-attributes/new">
            <Button className="w-full sm:w-auto min-h-[44px] border">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Atributo
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar atributos</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto min-h-[44px] border">
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de atributos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : attributes.length === 0 ? (
            <div className="text-center py-8">
              <Tag className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                No hay atributos configurados
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Comienza creando tu primer atributo de catálogo (por ejemplo, Color).
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {attributes.map((attribute) => (
                <div
                  key={attribute.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg space-y-4 sm:space-y-0 gap-4"
                >
                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                    <div className="h-12 w-12 rounded flex items-center justify-center flex-shrink-0 bg-blue-100 dark:bg-blue-900/50">
                      <Tag className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-sm sm:text-base truncate">
                          {attribute.name}
                        </h3>
                        {attribute.mlAttributeId && (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                            ML ID: {attribute.mlAttributeId}
                          </span>
                        )}
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          Valores: {Array.isArray(attribute.values) ? attribute.values.length : 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <Link href={`/admin/product-attributes/${attribute.id}/edit`}>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        aria-label={`Editar ${attribute.name}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteClick(attribute.id)}
                      className="h-9 w-9"
                      aria-label={`Eliminar ${attribute.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        title="Eliminar atributo"
        description="¿Estás seguro de que quieres eliminar este atributo? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}
