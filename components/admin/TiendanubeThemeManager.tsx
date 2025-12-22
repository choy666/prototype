'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Upload,
  Eye,
  Trash2,
  RefreshCw,
  Palette,
  Code,
  Rocket,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface TiendanubeScript {
  id: string;
  name: string;
  script: string;
  pages: string[];
  position: string;
  created_at: string;
  updated_at: string;
}

interface BuildStatus {
  building: boolean;
  lastBuild?: string;
  cssSize?: number;
  jsSize?: number;
}

export function TiendanubeThemeManager() {
  const [storeId, setStoreId] = useState('');
  const [scripts, setScripts] = useState<TiendanubeScript[]>([]);
  const [loading, setLoading] = useState(false);
  const [buildStatus, setBuildStatus] = useState<BuildStatus>({ building: false });
  const [activeTab, setActiveTab] = useState('scripts');
  
  // Estados para edición
  const [customCSS, setCustomCSS] = useState('');
  const [customJS, setCustomJS] = useState('');
  const [selectedPages, setSelectedPages] = useState<string[]>(['product']);

  const pages = [
    { id: 'home', label: 'Inicio' },
    { id: 'product', label: 'Producto' },
    { id: 'category', label: 'Categoría' },
    { id: 'cart', label: 'Carrito' }
  ];

  const loadScripts = useCallback(async () => {
    if (!storeId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/tiendanube/scripts?storeId=${storeId}`);
      const data = await response.json();
      
      if (data.success) {
        setScripts(data.scripts);
      }
    } catch {
      toast.error('Error cargando scripts');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    // Cargar scripts existentes
    if (storeId) {
      loadScripts();
    }
  }, [storeId, loadScripts]);

  const deployStyles = async () => {
    if (!storeId || !customCSS) {
      toast.error('Seleccione tienda y agregue CSS');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/tiendanube/scripts/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          type: 'css',
          content: customCSS,
          pages: selectedPages,
          name: `custom-theme-${Date.now()}`
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Estilos deployados exitosamente');
        loadScripts();
        setCustomCSS('');
      } else {
        toast.error(data.error || 'Error deployando estilos');
      }
    } catch {
      toast.error('Error al deployar estilos');
    } finally {
      setLoading(false);
    }
  };

  const deployJS = async () => {
    if (!storeId || !customJS) {
      toast.error('Seleccione tienda y agregue JavaScript');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/tiendanube/scripts/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          type: 'js',
          content: customJS,
          pages: selectedPages,
          name: `custom-components-${Date.now()}`
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Componentes deployados exitosamente');
        loadScripts();
        setCustomJS('');
      } else {
        toast.error(data.error || 'Error deployando componentes');
      }
    } catch {
      toast.error('Error al deployar componentes');
    } finally {
      setLoading(false);
    }
  };

  const buildAssets = async () => {
    setBuildStatus({ building: true });
    
    try {
      // Ejecutar build script
      const response = await fetch('/api/admin/tiendanube/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Assets construidos exitosamente');
        setBuildStatus({
          building: false,
          lastBuild: new Date().toISOString(),
          cssSize: data.manifest?.assets?.css?.size,
          jsSize: data.manifest?.assets?.js?.size
        });
      } else {
        toast.error(data.error || 'Error construyendo assets');
        setBuildStatus({ building: false });
      }
    } catch {
      toast.error('Error en el build');
      setBuildStatus({ building: false });
    }
  };

  const deleteScript = async (scriptId: string) => {
    if (!confirm('¿Está seguro de eliminar este script?')) return;
    
    try {
      const response = await fetch(`/api/admin/tiendanube/scripts/${scriptId}?storeId=${storeId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Script eliminado');
        loadScripts();
      } else {
        toast.error(data.error || 'Error eliminando script');
      }
    } catch {
      toast.error('Error al eliminar script');
    }
  };

  const previewStore = () => {
    if (!storeId) {
      toast.error('Seleccione una tienda');
      return;
    }
    window.open(`https://www.tiendanube.com.ar/stores/${storeId}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="h-6 w-6" />
            Theme Manager Tiendanube
          </h2>
          <p className="text-gray-600">
            Personaliza la apariencia de tu tienda Tiendanube
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={previewStore}
            variant="outline"
            size="sm"
          >
            <Eye className="h-4 w-4 mr-2" />
            Vista Previa
          </Button>
          <Button
            onClick={buildAssets}
            disabled={buildStatus.building}
            size="sm"
          >
            {buildStatus.building ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Building...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Build Assets
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Store Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Tienda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="storeId">Store ID</Label>
              <input
                id="storeId"
                type="text"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                placeholder="Ej: 1234567"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={loadScripts} disabled={!storeId || loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Cargar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Build Status */}
      {buildStatus.lastBuild && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">Último build exitoso</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>CSS: {((buildStatus.cssSize || 0) / 1024).toFixed(1)}KB</span>
                <span>JS: {((buildStatus.jsSize || 0) / 1024).toFixed(1)}KB</span>
                <span>{new Date(buildStatus.lastBuild).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="scripts" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Scripts Activos
          </TabsTrigger>
          <TabsTrigger value="css" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            CSS Personalizado
          </TabsTrigger>
          <TabsTrigger value="js" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            JavaScript
          </TabsTrigger>
        </TabsList>

        {/* Scripts Activos */}
        <TabsContent value="scripts">
          <Card>
            <CardHeader>
              <CardTitle>Scripts Deployados</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin" />
                  <p className="mt-2 text-gray-600">Cargando scripts...</p>
                </div>
              ) : scripts.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No hay scripts activos</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scripts.map((script: TiendanubeScript) => (
                    <div key={script.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{script.name}</h4>
                        <p className="text-sm text-gray-600">
                          Páginas: {script.pages.join(', ')}
                        </p>
                        <p className="text-xs text-gray-500">
                          Actualizado: {new Date(script.updated_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground">{script.position}</span>
                        <Button
                          onClick={() => deleteScript(script.id)}
                          variant="outline"
                          size="sm"
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
        </TabsContent>

        {/* CSS Personalizado */}
        <TabsContent value="css">
          <Card>
            <CardHeader>
              <CardTitle>Deploy CSS Personalizado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Páginas donde aplicar</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {pages.map((page) => (
                    <label key={page.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedPages.includes(page.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPages([...selectedPages, page.id]);
                          } else {
                            setSelectedPages(selectedPages.filter((p: string) => p !== page.id));
                          }
                        }}
                      />
                      <span className="text-sm">{page.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <Label htmlFor="cssContent">CSS</Label>
                <Textarea
                  id="cssContent"
                  value={customCSS}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomCSS(e.target.value)}
                  placeholder="/* Ingresa tu CSS personalizado */"
                  className="mt-1 font-mono text-sm"
                  rows={10}
                />
              </div>
              
              <Button
                onClick={deployStyles}
                disabled={!storeId || !customCSS || loading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Deploy CSS
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* JavaScript */}
        <TabsContent value="js">
          <Card>
            <CardHeader>
              <CardTitle>Deploy JavaScript Personalizado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="jsContent">JavaScript</Label>
                <Textarea
                  id="jsContent"
                  value={customJS}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomJS(e.target.value)}
                  placeholder="// Ingresa tu JavaScript personalizado"
                  className="mt-1 font-mono text-sm"
                  rows={10}
                />
              </div>
              
              <Button
                onClick={deployJS}
                disabled={!storeId || !customJS || loading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Deploy JavaScript
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}