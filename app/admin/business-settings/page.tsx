"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Save, Eye, EyeOff, MapPin, ExternalLink, RefreshCw } from "lucide-react";
import { updateBusinessSettings, getBusinessSettings } from "@/lib/actions/business-settings";

interface ShippingConfig {
  freeShippingThreshold: number;
  internalShippingCost: number;
}

interface ScheduleDayLegacy {
  dia: string;
  abierto: boolean;
  horarios: string[];
}

interface ScheduleDayNew {
  dia: string;
  abierto: boolean;
  horarios: {
    maniana: string;
    tarde: string;
  };
}

interface BusinessSettingsData {
  id: number;
  businessName: string;
  description: string | null;
  zipCode: string;
  address: string;
  phoneNumber?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  purchaseProtected: boolean;
  shippingConfig: ShippingConfig;
  schedule?: {
    dias: Array<ScheduleDayNew>;
  };
  socialMedia?: Record<string, string>;
  images?: Array<{url: string, alt?: string}>;
  location?: Record<string, string>;
  iframeUrl?: string | null;
}

export default function BusinessSettingsPage() {
  const [settings, setSettings] = useState<BusinessSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { toast } = useToast();

  const loadSettings = useCallback(async () => {
    try {
      const data = await getBusinessSettings();
      if (data) {
        // Migración de datos de horarios si es necesario
        if (data.schedule && typeof data.schedule === 'object' && 'dias' in data.schedule && Array.isArray(data.schedule.dias)) {
          data.schedule.dias = data.schedule.dias.map((dia: ScheduleDayLegacy | ScheduleDayNew): ScheduleDayNew => {
            // Si horarios es un array (formato antiguo), convertir al nuevo formato
            if (Array.isArray((dia as ScheduleDayLegacy).horarios)) {
              return {
                ...dia,
                horarios: {
                  maniana: (dia as ScheduleDayLegacy).horarios[0] || "",
                  tarde: ""
                }
              };
            }
            // Si ya tiene el nuevo formato, mantenerlo
            return dia as ScheduleDayNew;
          });
        }
        setSettings(data as BusinessSettingsData);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "Error",
        description: "Error al cargar la configuración",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const result = await updateBusinessSettings(settings.id, settings);
      if (result.success) {
        toast({
          title: "Configuración guardada",
          description: "Cambios guardados exitosamente"
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al guardar",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Error al guardar la configuración",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof BusinessSettingsData, value: unknown) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  const updateShippingConfig = (field: "freeShippingThreshold" | "internalShippingCost", value: number) => {
    if (!settings) return;
    const currentConfig: ShippingConfig = settings.shippingConfig;
    setSettings({
      ...settings,
      shippingConfig: {
        ...currentConfig,
        [field]: value,
      },
    });
  };

  const updateSocialMedia = (platform: string, value: string) => {
    if (!settings) return;
    const currentSocialMedia = (settings.socialMedia as Record<string, string>) || {};
    setSettings({
      ...settings,
      socialMedia: {
        ...currentSocialMedia,
        [platform]: value,
      },
    });
  };

  const updateScheduleDay = (index: number, field: "abierto" | "horarios", value: boolean | { maniana: string; tarde: string }) => {
    if (!settings || !settings.schedule) return;
    
    const newDias = [...settings.schedule.dias];
    if (field === "abierto") {
      newDias[index] = { 
        ...newDias[index], 
        [field]: value as boolean, 
        horarios: value ? newDias[index].horarios : { maniana: "", tarde: "" }
      };
    } else {
      newDias[index] = { ...newDias[index], [field]: value as { maniana: string; tarde: string } };
    }
    
    setSettings({
      ...settings,
      schedule: {
        dias: newDias,
      },
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Cargando...</div>;
  }

  if (!settings) {
    return <div className="flex items-center justify-center h-64">No se encontró la configuración</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuración del Negocio</h1>
          <p className="text-muted-foreground">
            Gestiona la información de tu negocio que se mostrará en las secciones Nosotros y Envíos
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Información General</TabsTrigger>
          <TabsTrigger value="contacto">Contacto</TabsTrigger>
          <TabsTrigger value="envios">Envíos</TabsTrigger>
          <TabsTrigger value="horarios">Horarios</TabsTrigger>
          <TabsTrigger value="redes">Redes Sociales</TabsTrigger>
          <TabsTrigger value="iframe">Iframe Nosotros</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información del Negocio</CardTitle>
              <CardDescription>
                Datos básicos que se mostrarán en la sección Nosotros
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Nombre del Negocio</Label>
                <Input
                  id="businessName"
                  value={settings.businessName}
                  onChange={(e) => updateField("businessName", e.target.value)}
                  placeholder="Ingresa el nombre de tu negocio"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={settings.description || ""}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Describe tu negocio, tu historia, misión y valores..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={settings.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  placeholder="Calle, Número, Ciudad, Provincia"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zipCode">Código Postal</Label>
                <Input
                  id="zipCode"
                  value={settings.zipCode}
                  onChange={(e) => updateField("zipCode", e.target.value)}
                  placeholder="Ej: 1001"
                  maxLength={10}
                />
                <p className="text-sm text-muted-foreground">
                  Este código postal se usará para determinar los envíos internos
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="purchaseProtected"
                  checked={settings.purchaseProtected}
                  onCheckedChange={(checked: boolean) => updateField("purchaseProtected", checked)}
                />
                <Label htmlFor="purchaseProtected">Mostrar &quot;Compra Protegida&quot;</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacto" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Información de Contacto</CardTitle>
              <CardDescription>
                Teléfonos, email y WhatsApp para que los clientes puedan comunicarse
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Teléfono</Label>
                <Input
                  id="phoneNumber"
                  value={settings.phoneNumber || ""}
                  onChange={(e) => updateField("phoneNumber", e.target.value)}
                  placeholder="Ej: +54 11 1234-5678"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.email || ""}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="contacto@tu-negocio.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={settings.whatsapp || ""}
                  onChange={(e) => updateField("whatsapp", e.target.value)}
                  placeholder="Ej: +54 11 1234-5678"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="envios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Envíos Internos</CardTitle>
              <CardDescription>
                Configura los costos y condiciones para envíos dentro de tu código postal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="internalShippingCost">Costo de Envío Interno</Label>
                <Input
                  id="internalShippingCost"
                  type="number"
                  value={settings.shippingConfig?.internalShippingCost || 3000}
                  onChange={(e) => updateShippingConfig("internalShippingCost", Number(e.target.value))}
                  placeholder="3000"
                />
                <p className="text-sm text-muted-foreground">
                  Costo para compras inferiores al monto mínimo
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="freeShippingThreshold">
                  Envío Gratis a partir de
                </Label>
                <Input
                  id="freeShippingThreshold"
                  type="number"
                  value={settings.shippingConfig?.freeShippingThreshold || 30000}
                  onChange={(e) => updateShippingConfig("freeShippingThreshold", Number(e.target.value))}
                  placeholder="30000"
                />
                <p className="text-sm text-muted-foreground">
                  Las compras superiores a este monto tendrán envío interno gratis
                </p>
              </div>

              <Separator />

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Resumen de Envíos</h4>
                <div className="space-y-1 text-sm">
                  <div>• Código postal interno: <Badge variant="secondary">{settings.zipCode}</Badge></div>
                  <div>• Envío interno: <Badge variant="outline">${settings.shippingConfig?.internalShippingCost || 0}</Badge></div>
                  <div>• Envío gratis a partir de: <Badge variant="outline">${settings.shippingConfig?.freeShippingThreshold || 0}</Badge></div>
                  <div>• Fuera del CP: <Badge variant="outline">Mercado Envíos 2</Badge></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="horarios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Horarios de Atención</CardTitle>
              <CardDescription>
                Configura los días y horarios en que tu negocio está abierto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.schedule?.dias.map((dia, index) => (
                <div key={dia.dia} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <Switch
                        checked={dia.abierto}
                        onCheckedChange={(checked: boolean) => updateScheduleDay(index, "abierto", checked)}
                      />
                      <Label className="font-medium text-base">{dia.dia}</Label>
                    </div>
                  </div>
                  
                  {dia.abierto && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Label className="text-sm font-medium text-muted-foreground w-20">Mañana:</Label>
                        <Input
                          value={dia.horarios.maniana || ""}
                          onChange={(e) => updateScheduleDay(index, "horarios", { 
                            ...dia.horarios, 
                            maniana: e.target.value 
                          })}
                          placeholder="Ej: 08:00 - 12:00"
                          className="flex-1"
                        />
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Label className="text-sm font-medium text-muted-foreground w-20">Tarde:</Label>
                        <Input
                          value={dia.horarios.tarde || ""}
                          onChange={(e) => updateScheduleDay(index, "horarios", { 
                            ...dia.horarios, 
                            tarde: e.target.value 
                          })}
                          placeholder="Ej: 16:00 - 20:00"
                          className="flex-1"
                        />
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        💡 Puedes dejar uno de los turnos vacío si solo trabajas en un horario
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Redes Sociales</CardTitle>
              <CardDescription>
                Agrega los enlaces a tus redes sociales
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="facebook">Facebook</Label>
                <Input
                  id="facebook"
                  value={(settings.socialMedia as Record<string, string>)?.facebook || ""}
                  onChange={(e) => updateSocialMedia("facebook", e.target.value)}
                  placeholder="https://facebook.com/tu-negocio"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  value={(settings.socialMedia as Record<string, string>)?.instagram || ""}
                  onChange={(e) => updateSocialMedia("instagram", e.target.value)}
                  placeholder="https://instagram.com/tu-negocio"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter">Twitter/X</Label>
                <Input
                  id="twitter"
                  value={(settings.socialMedia as Record<string, string>)?.twitter || ""}
                  onChange={(e) => updateSocialMedia("twitter", e.target.value)}
                  placeholder="https://twitter.com/tu-negocio"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iframe" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mapa de Google para página Nosotros</CardTitle>
              <CardDescription>
                Incrusta el mapa de tu ubicación física que se mostrará en la página Nosotros
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="iframeUrl" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Código del Iframe de Google Maps
                  </Label>
                  {settings.iframeUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPreview(!showPreview)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {showPreview ? "Ocultar" : "Mostrar"} vista previa
                    </Button>
                  )}
                </div>
                <Textarea
                  id="iframeUrl"
                  value={settings.iframeUrl || ""}
                  onChange={(e) => updateField("iframeUrl", e.target.value)}
                  placeholder='<iframe src="https://www.google.com/maps/embed?..." width="400" height="300" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>'
                  rows={4}
                  className="font-mono text-sm resize-none"
                />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <p>
                    📍 Ve a Google Maps → Compartir → Incrustar mapa → Copia el código HTML
                  </p>
                  {settings.iframeUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPreviewLoading(true);
                        setTimeout(() => setPreviewLoading(false), 1000);
                      }}
                      className="gap-2"
                    >
                      <RefreshCw className={`h-3 w-3 ${previewLoading ? 'animate-spin' : ''}`} />
                      Recargar
                    </Button>
                  )}
                </div>
              </div>

              {settings.iframeUrl && showPreview && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Vista previa del mapa
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      asChild
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          const match = settings.iframeUrl?.match(/src="([^"]+)"/);
                          if (match && match[1]) {
                            window.open(match[1], '_blank', 'noopener,noreferrer');
                          }
                        }}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Abrir en nueva pestaña
                      </a>
                    </Button>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg opacity-50" />
                    <div className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                      {previewLoading ? (
                        <div className="flex items-center justify-center h-96">
                          <div className="flex flex-col items-center gap-2">
                            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Cargando mapa...</p>
                          </div>
                        </div>
                      ) : (
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: settings.iframeUrl.replace(
                              /width="[^"]*"/, 
                              'width="100%"'
                            ).replace(
                              /height="[^"]*"/, 
                              'height="400"'
                            ).replace(
                              /style="([^"]*)"/, 
                              'style="$1 width: 100%; height: 400px; border: 0;"'
                            ) || settings.iframeUrl
                          }}
                          className="w-full h-96 overflow-hidden"
                        />
                      )}
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Badge variant="secondary" className="text-xs">
                        Vista previa interactiva
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    💡 El mapa se mostrará exactamente así en la página Nosotros
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
