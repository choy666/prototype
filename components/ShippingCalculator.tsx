"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calculator, MapPin, Truck, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface ShippingCalculatorProps {
  businessZipCode: string;
}

export default function ShippingCalculator({ businessZipCode }: ShippingCalculatorProps) {
  const [zipCode, setZipCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    isInternal: boolean;
    cost: number;
    estimated: string;
    type: string;
  } | null>(null);
  const { toast } = useToast();

  const calculateShipping = async () => {
    if (!zipCode.trim()) {
      toast({
        title: "Error",
        description: "Por favor, ingresá un código postal",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Simular cálculo de envío (en producción, llamar a la API real)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const isInternal = zipCode.trim() === businessZipCode;
      
      if (isInternal) {
        // Envío interno - lógica de precios
        const orderTotal = 25000; // Simular un total de pedido (en producción, esto vendría del carrito)
        
        if (orderTotal >= 30000) {
          setResult({
            isInternal: true,
            cost: 0,
            estimated: "24 horas",
            type: "Envío Interno Gratis"
          });
        } else {
          setResult({
            isInternal: true,
            cost: 3000,
            estimated: "24 horas",
            type: "Envío Interno"
          });
        }
      } else {
        // Envío externo - simular respuesta de ME2
        setResult({
          isInternal: false,
          cost: 2390,
          estimated: "3-5 días",
          type: "Mercado Envíos 2 - Estándar"
        });
      }
    } catch (error) {
      console.error('Error calculating shipping:', error);
      toast({
        title: "Error",
        description: "Error al calcular el envío. Intentá nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Calculadora de Envíos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="zipCode">Código Postal</Label>
          <div className="flex gap-2">
            <Input
              id="zipCode"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="Ej: 1001"
              maxLength={10}
              className="flex-1"
            />
            <Button 
              onClick={calculateShipping} 
              disabled={loading}
              className="min-w-[120px]"
            >
              {loading ? "Calculando..." : "Calcular"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Ingresá el código postal de destino para calcular el costo
          </p>
        </div>

        {result && (
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              {result.isInternal ? (
                <MapPin className="h-5 w-5 text-green-600" />
              ) : (
                <Truck className="h-5 w-5 text-blue-600" />
              )}
              <span className="font-semibold">{result.type}</span>
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Costo de envío:</span>
                <Badge variant={result.cost === 0 ? "default" : "secondary"} className="text-sm">
                  {result.cost === 0 ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      GRATIS
                    </>
                  ) : (
                    `$${result.cost.toLocaleString('es-AR')}`
                  )}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Tiempo estimado:</span>
                <span className="text-sm font-medium">{result.estimated}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Tipo:</span>
                <Badge variant="outline" className="text-xs">
                  {result.isInternal ? "Envío Local" : "Mercado Envíos 2"}
                </Badge>
              </div>
            </div>

            {result.isInternal && result.cost > 0 && (
              <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs text-green-700 dark:text-green-300">
                💡 ¡Con compras superiores a $30.000 el envío interno es gratis!
              </div>
            )}

            {!result.isInternal && (
              <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
                💡 Este envío es realizado a través de Mercado Envíos 2 con seguimiento online incluido.
              </div>
            )}
          </div>
        )}

        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground">
            * Los costos de envío externo son calculados por Mercado Envíos 2 y pueden variar según el peso y volumen del paquete.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
