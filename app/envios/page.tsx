import { Metadata } from "next";
import { getBusinessContactInfo, getBusinessShippingConfig } from "@/lib/actions/business-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Truck, Clock, CheckCircle, Package } from "lucide-react";
import ShippingCalculator from "@/components/ShippingCalculator";

export const metadata: Metadata = {
  title: "Envíos - Mi Negocio",
  description: "Información sobre envíos y costos de entrega",
};

async function EnviosPage() {
  const businessSettings = await getBusinessContactInfo();
  const shippingConfig = await getBusinessShippingConfig();

  if (!businessSettings || !shippingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Página no disponible</h1>
          <p className="text-muted-foreground">
            Por el momento, la información de envíos no está disponible.
          </p>
        </div>
      </div>
    );
  }

  // Mapa de ubicación (comentado - requiere API key de Google Maps)
  // const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent((businessSettings.location as Record<string, string>)?.address || businessSettings.address)}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-primary/80 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Envíos a Todo Argentina
            </h1>
            <p className="text-xl md:text-2xl opacity-90">
              Rápidos, seguros y a los mejores precios
            </p>
          </div>
        </div>
      </section>

      {/* Información Principal de Envíos */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Envíos Internos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Envíos Internos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      Para tu código postal: <Badge variant="secondary">{businessSettings.zipCode}</Badge>
                    </div>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Entrega dentro de las próximas 24 horas post compra
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Compras menores a ${shippingConfig.freeShippingThreshold.toLocaleString('es-AR')}</span>
                      <Badge variant="outline">${shippingConfig.internalShippingCost.toLocaleString('es-AR')}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-900/20">
                      <span className="font-medium">Compras superiores a ${shippingConfig.freeShippingThreshold.toLocaleString('es-AR')}</span>
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                            GRATIS
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Entrega: 24 horas hábiles
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Envíos Externos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    Envíos al Resto del País
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-semibold mb-2">Mercado Envíos 2</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Para todo Argentina fuera de tu código postal
                    </p>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="text-sm">Integración con Mercado Libre</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Envío estándar: 3-5 días hábiles</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Envío prioritario: 1-2 días hábiles</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Seguimiento online</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Seguro contra pérdidas</span>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground pt-2">
                    El costo se calcula automáticamente según tu ubicación y el peso del paquete
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Calculadora de Envíos */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Calculá tu Envío</h2>
              <p className="text-muted-foreground">
                Ingresá tu código postal para calcular el costo de envío
              </p>
            </div>
            
            <ShippingCalculator businessZipCode={businessSettings.zipCode} />
          </div>
        </div>
      </section>

      {/* Ubicación del Negocio */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Dónde Enviamos</h2>
            
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Información de Zonas */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Zonas de Envío Interno</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="font-medium">Código Postal: {businessSettings.zipCode}</p>
                          <p className="text-sm text-muted-foreground">
                            Entrega en 24 horas
                          </p>
                        </div>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-sm text-green-700 dark:text-green-300">
                          Si estás en esta zona, tu pedido llegara durante las 24 horas hábiles posteriores a la compra.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Zonas de Envío Externo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                        <div>
                          <p className="font-medium">Todo Argentina</p>
                          <p className="text-sm text-muted-foreground">
                            A través de Mercado Envíos 2
                          </p>
                        </div>
                      </div>
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Cubrimos todo el país con la confianza y seguridad de Mercado Libre.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Mapa */}
              <Card>
                <CardHeader>
                  <CardTitle>Nuestra Ubicación</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video rounded-lg overflow-hidden border">
                    {businessSettings.iframeUrl ? (
                      <div 
                        className="w-full h-full"
                        dangerouslySetInnerHTML={{ 
                          __html: businessSettings.iframeUrl.replace(
                            /width="[^"]*"/, 
                            'width="100%"'
                          ).replace(
                            /height="[^"]*"/, 
                            'height="100%"'
                          ).replace(
                            /style="([^"]*)"/, 
                            'style="$1 width: 100%; height: 100%; border: 0;"'
                          ) || businessSettings.iframeUrl
                        }}
                      />
                    ) : (
                      // Mapa de OpenStreetMap gratuito
                      // Si no hay coordenadas, usar un mapa basado en la dirección
                      <iframe
                        src={businessSettings.location 
                          ? `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
                              `${((businessSettings.location as unknown) as { lng: number; lat: number }).lng - 0.01},${((businessSettings.location as unknown) as { lng: number; lat: number }).lat - 0.01},${((businessSettings.location as unknown) as { lng: number; lat: number }).lng + 0.01},${((businessSettings.location as unknown) as { lng: number; lat: number }).lat + 0.01}`
                            )}&layer=mapnik&marker=${encodeURIComponent(
                              `${((businessSettings.location as unknown) as { lng: number; lat: number }).lat},${((businessSettings.location as unknown) as { lng: number; lat: number }).lng}`
                            )}`
                          : `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
                              `-58.5,-34.7,-58.3,-34.5`
                            )}&layer=mapnik&marker=${encodeURIComponent(
                              `-34.6037,-58.3816`
                            )}`
                        }
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      <strong>Dirección:</strong> {businessSettings.address}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Código Postal:</strong> {businessSettings.zipCode}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Preguntas Frecuentes */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Preguntas Frecuentes</h2>
            
            <div className="grid gap-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">¿Cuánto tarda el envío interno?</h3>
                  <p className="text-muted-foreground">
                    Los envíos internos se realizan dentro de las 24 horas hábiles posteriores a la compra.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">¿Cómo sé si mi compra tiene envío gratis?</h3>
                  <p className="text-muted-foreground">
                    Si tu compra supera los ${shippingConfig.freeShippingThreshold.toLocaleString('es-AR')} y estás en nuestro código postal, el envío es totalmente gratis.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">¿Puedo seguir mi pedido?</h3>
                  <p className="text-muted-foreground">
                    Sí, todos los envíos (internos y externos) incluyen número de seguimiento para que puedas ver dónde está tu paquete en todo momento.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default EnviosPage;
