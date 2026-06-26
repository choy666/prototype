'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface PermissionStatus {
  hasAllScopes: boolean;
  missingScopes: string[];
  availableScopes: string[];
}

interface ModulePermissions {
  auth: PermissionStatus;
  products: PermissionStatus;
  inventory: PermissionStatus;
  orders: PermissionStatus;
  messages: PermissionStatus;
}

interface PermissionsData {
  availableScopes: string[];
  modules: ModulePermissions;
  overall: PermissionStatus;
  lastChecked: string;
}

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  read: 'Lectura básica de datos',
  write: 'Creación y modificación de recursos',
};

const MODULE_NAMES: Record<string, string> = {
  auth: 'Autenticación',
  products: 'Productos',
  inventory: 'Inventario',
  orders: 'Órdenes',
  messages: 'Mensajes',
};

export default function MercadoLibrePermissions() {
  const [permissions, setPermissions] = useState<PermissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPermissions = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/auth/mercadolibre/permissions');
      const data = await response.json();

      if (data.success) {
        setPermissions(data.data);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Error al obtener permisos',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast({
        title: 'Error',
        description: 'Error al conectar con el servidor',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Permisos de Mercado Libre</CardTitle>
          <CardDescription>Cargando estado de permisos...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!permissions) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Permisos de Mercado Libre</CardTitle>
          <CardDescription>Error al cargar permisos</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchPermissions} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasCriticalIssues = !permissions.overall.hasAllScopes;

  return (
    <div className="space-y-6">
      {/* Alerta general */}
      {hasCriticalIssues && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Faltan permisos críticos de Mercado Libre. Algunas funcionalidades pueden no funcionar correctamente.
          </AlertDescription>
        </Alert>
      )}

      {/* Estado general */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Estado General de Permisos</CardTitle>
              <CardDescription>
                Última verificación: {new Date(permissions.lastChecked).toLocaleString()}
              </CardDescription>
            </div>
            <Button onClick={fetchPermissions} disabled={refreshing} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {permissions.overall.hasAllScopes ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-green-700 font-medium">Todos los permisos activos</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="text-red-700 font-medium">
                  Faltan {permissions.overall.missingScopes.length} permisos
                </span>
              </div>
            )}
          </div>

          {permissions.overall.missingScopes.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Permisos faltantes:</p>
              <div className="flex flex-wrap gap-2">
                {permissions.overall.missingScopes.map((scope: string) => (
                  <Badge key={scope} variant="destructive">
                    {scope}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permisos por módulo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(permissions.modules).map(([module, status]) => (
          <Card key={module}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{MODULE_NAMES[module]}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {status.hasAllScopes ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-700">Completo</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-700">Incompleto</span>
                  </div>
                )}

                {status.missingScopes.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Faltan:</p>
                    <div className="flex flex-wrap gap-1">
                      {status.missingScopes.map((scope: string) => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scopes disponibles */}
      <Card>
        <CardHeader>
          <CardTitle>Scopes Disponibles</CardTitle>
          <CardDescription>
            Lista de todos los permisos actualmente autorizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {permissions.availableScopes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {permissions.availableScopes.map((scope) => (
                <Badge key={scope} variant="secondary">
                  {scope}
                  {SCOPE_DESCRIPTIONS[scope] && (
                    <span className="ml-1 text-xs opacity-75">
                      - {SCOPE_DESCRIPTIONS[scope]}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No hay scopes disponibles</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
