'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/use-toast';

interface CategorySuggestButtonProps {
  title: string;
  description?: string;
  price?: number;
  onCategorySelected: (categoryId: string) => void;
  currentCategoryId?: string;
}

interface PredictionResponse {
  prediction: {
    mlCategoryId: string;
    mlName: string;
    foundInLocalCatalog: boolean;
    localCategoryId: string | null;
    localName: string | null;
  };
  message: string;
}

export function CategorySuggestButton({
  title,
  description,
  price,
  onCategorySelected,
  currentCategoryId,
}: CategorySuggestButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const { toast } = useToast();

  const handleSuggestCategory = async () => {
    if (!title.trim()) {
      toast({
        title: 'Error',
        description: 'El título del producto es requerido para sugerir una categoría',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setPrediction(null);

    try {
      const response = await fetch('/api/mercadolibre/category-predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description?.trim(),
          price,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al sugerir categoría');
      }

      const data: PredictionResponse = await response.json();
      setPrediction(data);

      if (data.prediction.foundInLocalCatalog && data.prediction.localCategoryId) {
        toast({
          title: 'Categoría sugerida',
          description: data.message,
        });
      } else {
        toast({
          title: 'Sugerencia no disponible',
          description: data.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error suggesting category:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo sugerir una categoría',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySuggestion = () => {
    if (prediction?.prediction.localCategoryId) {
      onCategorySelected(prediction.prediction.localCategoryId);
      toast({
        title: 'Categoría aplicada',
        description: `Se seleccionó: ${prediction.prediction.localName}`,
      });
    }
  };

  return (
    <div className="space-y-3 mt-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleSuggestCategory}
        disabled={isLoading || !title.trim()}
        className="w-full"
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        Sugerir categoría ML
      </Button>

      {prediction && (
        <div className="p-3 border rounded-md bg-muted/30">
          <p className="text-sm font-medium mb-2">Sugerencia de ML:</p>
          <p className="text-sm text-muted-foreground mb-2">
            {prediction.prediction.mlName} ({prediction.prediction.mlCategoryId})
          </p>
          
          {prediction.prediction.foundInLocalCatalog ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-600">✓ Disponible en catálogo</span>
              {prediction.prediction.localCategoryId !== currentCategoryId && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleApplySuggestion}
                  className="ml-auto"
                >
                  Aplicar sugerencia
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-orange-600">
              ⚠️ No está en tu catálogo local configurado
            </p>
          )}
        </div>
      )}
    </div>
  );
}
