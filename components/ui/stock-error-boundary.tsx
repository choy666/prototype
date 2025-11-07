'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@/lib/utils/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface StockErrorBoundaryProps {
  children: ReactNode;
  productId?: string;
}

interface StockErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string;
}

export class StockErrorBoundary extends Component<StockErrorBoundaryProps, StockErrorBoundaryState> {
  constructor(props: StockErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorId: '' };
  }

  static getDerivedStateFromError(error: Error): StockErrorBoundaryState {
    const errorId = `stock-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { productId } = this.props;
    const { errorId } = this.state;

    console.error('StockErrorBoundary caught an error:', error, errorInfo);

    logger.error('Error capturado en página de stock', {
      errorId,
      productId,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: typeof window !== 'undefined' ? window.location.href : 'server-side',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server-side',
      timestamp: new Date().toISOString(),
      additionalContext: 'Error en componente de gestión de stock'
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorId: '' });
  };

  render() {
    if (this.state.hasError) {
      const { productId } = this.props;
      const { errorId } = this.state;

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Error en Gestión de Stock
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                Ha ocurrido un error inesperado al cargar la página de gestión de stock.
              </p>
              <div className="text-sm text-gray-500">
                <p>ID del error: {errorId}</p>
                <p>Producto ID: {productId || 'N/A'}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={this.handleRetry} className="flex-1">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reintentar
                </Button>
                <Link href={`/admin/products/${productId}/edit`}>
                  <Button variant="outline" className="flex-1">
                    <Home className="mr-2 h-4 w-4" />
                    Volver al Producto
                  </Button>
                </Link>
              </div>
              <p className="text-xs text-gray-500">
                Si el problema persiste, contacta al soporte técnico con el ID del error.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
