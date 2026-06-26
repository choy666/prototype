"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/Tooltip";
import { Plus, Minus, History, Package } from "lucide-react";
import { useCallback } from "react";
import { adjustProductStock, adjustVariantStock, getStockHistory } from "@/lib/actions/stock";
import { useToast } from "@/components/ui/use-toast";

interface StockManagementProps {
  productId: number;
  productStock: number;
  variants: Array<{
    id: number;
    name?: string;
    description?: string;
    additionalAttributes?: Record<string, string>;
    price?: number;
    images?: string[];
    stock: number;
    isActive: boolean;
  }>;
}

interface StockLog {
  id: number;
  oldStock: number;
  newStock: number;
  change: number;
  reason: string;
  created_at: Date;
  userId: number;
}

interface PaginationState {
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
}

export function StockManagement({ productId, productStock: initialProductStock, variants: initialVariants }: StockManagementProps) {
  const [productStock, setProductStock] = useState(initialProductStock);
  const [variants, setVariants] = useState(initialVariants);
  const [stockHistory, setStockHistory] = useState<StockLog[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [historyPagination, setHistoryPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    hasMore: false,
  });
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const { toast } = useToast();

  // Estados para ajustes de stock
  const [productAdjustment, setProductAdjustment] = useState({ change: 0, reason: "" });
  const [variantAdjustments, setVariantAdjustments] = useState<Record<number, { change: number; reason: string }>>({});

  const loadStockHistoryCallback = useCallback(async (page: number = 1) => {
    try {
      const limit = 20;
      const offset = (page - 1) * limit;
      const history = await getStockHistory(productId, limit, offset);

      if (page === 1) {
        setStockHistory(history);
      } else {
        setStockHistory(prev => [...prev, ...history]);
      }

      setHistoryPagination(prev => ({
        ...prev,
        currentPage: page,
        hasMore: history.length === limit,
      }));
    } catch {
      console.error("Error loading stock history");
    }
  }, [productId]);

  useEffect(() => {
    loadStockHistoryCallback();
  }, [loadStockHistoryCallback]);



  const loadMoreHistory = useCallback(async () => {
    if (isLoadingMoreHistory || !historyPagination.hasMore) return;

    setIsLoadingMoreHistory(true);
    try {
      await loadStockHistoryCallback(historyPagination.currentPage + 1);
    } finally {
      setIsLoadingMoreHistory(false);
    }
  }, [isLoadingMoreHistory, historyPagination.hasMore, historyPagination.currentPage, loadStockHistoryCallback]);

  const handleProductStockAdjustment = async () => {
    if (!productAdjustment.change || !productAdjustment.reason.trim()) {
      toast({
        title: "Error",
        description: "Debes ingresar un cambio y una razón",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await adjustProductStock({
        productId,
        change: productAdjustment.change,
        reason: productAdjustment.reason,
      });

      setProductStock(result.newStock);
      setProductAdjustment({ change: 0, reason: "" });
      await loadStockHistoryCallback();

      toast({
        title: "Stock actualizado",
        description: `Stock del producto ajustado a ${result.newStock}`,
      });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo ajustar el stock del producto",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVariantStockAdjustment = async (variantId: number) => {
    const adjustment = variantAdjustments[variantId];
    if (!adjustment?.change || !adjustment.reason.trim()) {
      toast({
        title: "Error",
        description: "Debes ingresar un cambio y una razón",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await adjustVariantStock({
        variantId,
        change: adjustment.change,
        reason: adjustment.reason,
      });

      setVariants(prev => prev.map(v =>
        v.id === variantId ? { ...v, stock: result.newStock } : v
      ));

      setVariantAdjustments(prev => ({
        ...prev,
        [variantId]: { change: 0, reason: "" }
      }));

      await loadStockHistoryCallback();

      toast({
        title: "Stock actualizado",
        description: `Stock de la variante ajustado a ${result.newStock}`,
      });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo ajustar el stock de la variante",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Vista General</TabsTrigger>
          <TabsTrigger value="variants">Variantes</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Stock del Producto Base
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{productStock}</p>
                  <p className="text-sm text-gray-600">unidades disponibles</p>
                </div>
                <Badge variant={productStock > 0 ? "default" : "destructive"}>
                  {productStock > 0 ? "En stock" : "Sin stock"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="product-change">Cambio de stock</Label>
                  <Input
                    id="product-change"
                    type="number"
                    value={productAdjustment.change}
                    onChange={(e) => setProductAdjustment(prev => ({
                      ...prev,
                      change: parseInt(e.target.value) || 0
                    }))}
                    placeholder="Ej: 10 o -5"
                  />
                </div>
                <div>
                  <Label htmlFor="product-reason">Razón</Label>
                  <Input
                    id="product-reason"
                    value={productAdjustment.reason}
                    onChange={(e) => setProductAdjustment(prev => ({
                      ...prev,
                      reason: e.target.value
                    }))}
                    placeholder="Ej: Reabastecimiento"
                  />
                </div>
              </div>

              <Tooltip
                content={
                  productAdjustment.change > 0
                    ? "Aumentará el stock del producto base"
                    : productAdjustment.change < 0
                    ? "Reducirá el stock del producto base"
                    : "No hay cambio especificado"
                }
              >
                <Button
                  onClick={handleProductStockAdjustment}
                  disabled={isLoading || !productAdjustment.change || !productAdjustment.reason.trim()}
                  variant={
                    productAdjustment.change > 0
                      ? "default"
                      : productAdjustment.change < 0
                      ? "destructive"
                      : "secondary"
                  }
                  className={`w-full transition-all duration-200 ${
                    productAdjustment.change > 0
                      ? "hover:bg-green-600"
                      : productAdjustment.change < 0
                      ? "hover:bg-red-600"
                      : ""
                  }`}
                >
                  {productAdjustment.change > 0 ? (
                    <Plus className="h-4 w-4 mr-2" />
                  ) : (
                    <Minus className="h-4 w-4 mr-2" />
                  )}
                  {productAdjustment.change > 0
                    ? `Aumentar Stock (+${productAdjustment.change})`
                    : productAdjustment.change < 0
                    ? `Reducir Stock (${productAdjustment.change})`
                    : "Ajustar Stock (0)"}
                </Button>
              </Tooltip>
            </CardContent>
          </Card>

          {variants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resumen de Variantes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {variants.map((variant) => (
                    <div key={variant.id} className="p-4 border rounded-lg">
                      <p className="font-medium text-sm">
                        {variant.name || formatAdditionalAttributes(variant.additionalAttributes)}
                      </p>
                      {variant.price && (
                        <p className="text-sm text-gray-600">Precio: ${variant.price}</p>
                      )}
                      <p className="text-lg font-bold">{variant.stock} unidades</p>
                      <Badge variant={variant.stock > 0 ? "default" : "destructive"} className="mt-1">
                        {variant.stock > 0 ? "Disponible" : "Agotado"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="variants" className="space-y-4">
          {variants.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-600">No hay variantes configuradas para este producto.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Gestión de Variantes</h3>
              </div>

              <div className="grid gap-4">
                {variants.map((variant) => (
                  <Card key={variant.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Variante: {variant.name || formatAdditionalAttributes(variant.additionalAttributes)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xl font-bold">{variant.stock}</p>
                          <p className="text-sm text-gray-600">unidades disponibles</p>
                        </div>
                        <Badge variant={variant.stock > 0 ? "default" : "destructive"}>
                          {variant.stock > 0 ? "Disponible" : "Agotado"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Cambio de stock</Label>
                          <Input
                            type="number"
                            value={variantAdjustments[variant.id]?.change || 0}
                            onChange={(e) => setVariantAdjustments(prev => ({
                              ...prev,
                              [variant.id]: {
                                ...prev[variant.id],
                                change: parseInt(e.target.value) || 0
                              }
                            }))}
                            placeholder="Ej: 5 o -2"
                          />
                        </div>
                        <div>
                          <Label>Razón</Label>
                          <Input
                            value={variantAdjustments[variant.id]?.reason || ""}
                            onChange={(e) => setVariantAdjustments(prev => ({
                              ...prev,
                              [variant.id]: {
                                ...prev[variant.id],
                                reason: e.target.value
                              }
                            }))}
                            placeholder="Ej: Venta online"
                          />
                        </div>
                      </div>

                      <Tooltip
                        content={
                          (variantAdjustments[variant.id]?.change || 0) > 0
                            ? "Aumentará el stock de esta variante"
                            : (variantAdjustments[variant.id]?.change || 0) < 0
                            ? "Reducirá el stock de esta variante"
                            : "No hay cambio especificado"
                        }
                      >
                        <Button
                          onClick={() => handleVariantStockAdjustment(variant.id)}
                          disabled={isLoading || !(variantAdjustments[variant.id]?.change) || !(variantAdjustments[variant.id]?.reason?.trim())}
                          variant={
                            (variantAdjustments[variant.id]?.change || 0) > 0
                              ? "default"
                              : (variantAdjustments[variant.id]?.change || 0) < 0
                              ? "destructive"
                              : "secondary"
                          }
                          className={`w-full transition-all duration-200 ${
                            (variantAdjustments[variant.id]?.change || 0) > 0
                              ? "hover:bg-green-600"
                              : (variantAdjustments[variant.id]?.change || 0) < 0
                              ? "hover:bg-red-600"
                              : ""
                          }`}
                        >
                          {(variantAdjustments[variant.id]?.change || 0) > 0 ? (
                            <Plus className="h-4 w-4 mr-2" />
                          ) : (
                            <Minus className="h-4 w-4 mr-2" />
                          )}
                          {(variantAdjustments[variant.id]?.change || 0) > 0
                            ? `Aumentar Stock (+${variantAdjustments[variant.id]?.change})`
                            : (variantAdjustments[variant.id]?.change || 0) < 0
                            ? `Reducir Stock (${variantAdjustments[variant.id]?.change})`
                            : "Ajustar Stock (0)"}
                        </Button>
                      </Tooltip>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de Cambios de Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stockHistory.length === 0 ? (
                <p className="text-gray-600 text-center py-4">No hay historial de cambios aún.</p>
              ) : (
                <div className="space-y-2">
                  {stockHistory.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">
                          {log.change > 0 ? '+' : ''}{log.change} unidades
                        </p>
                        <p className="text-sm text-gray-600">{log.reason}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {log.oldStock} → {log.newStock}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {historyPagination.hasMore && (
                    <div className="text-center mt-4">
                      <Button
                        onClick={loadMoreHistory}
                        disabled={isLoadingMoreHistory}
                        variant="outline"
                      >
                        {isLoadingMoreHistory ? "Cargando..." : "Cargar más"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
