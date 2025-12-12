import { Metadata } from "next";
import React from "react";
import { getBusinessContactInfo } from "@/lib/actions/business-settings";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Mail, MessageCircle, Shield, Clock, Facebook, Instagram, Twitter } from "lucide-react";

interface ScheduleDay {
  dia: string;
  abierto: boolean;
  horarios: string[];
}

interface Schedule {
  dias: ScheduleDay[];
}

export const metadata: Metadata = {
  title: "Nosotros - Mi Negocio",
  description: "Conoce más sobre nuestra empresa, historia y valores",
};

export default async function NosotrosPage() {
  const businessSettings = await getBusinessContactInfo();

  if (!businessSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Página no disponible</h1>
          <p className="text-muted-foreground">
            Por el momento, la información de la empresa no está disponible.
          </p>
        </div>
      </div>
    );
  }

  // Cast to proper types after null check
  const settings = {
    businessName: businessSettings.businessName,
    description: businessSettings.description,
    address: businessSettings.address,
    zipCode: businessSettings.zipCode,
    phoneNumber: businessSettings.phoneNumber,
    email: businessSettings.email,
    whatsapp: businessSettings.whatsapp,
    purchaseProtected: businessSettings.purchaseProtected,
    schedule: businessSettings.schedule ? (businessSettings.schedule as unknown as Schedule) : undefined,
    socialMedia: businessSettings.socialMedia || {},
    images: businessSettings.images || [],
    location: businessSettings.location || {},
    iframeUrl: businessSettings.iframeUrl || null
  };

  const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(settings.location?.address || settings.address)}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-primary/80 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              {settings.businessName}
            </h1>
            <p className="text-xl md:text-2xl opacity-90">
              Tu tienda de confianza
            </p>
          </div>
        </div>
      </section>

      {/* Información Principal */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {settings.purchaseProtected && (
              <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3">
                  <Shield className="h-8 w-8 text-green-600 dark:text-green-400" />
                  <div>
                    <h3 className="font-semibold text-green-900 dark:text-green-100">
                      Compra Protegida
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Todas tus compras están protegidas. Tu seguridad es nuestra prioridad.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Información de Contacto y Ubicación */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Visítanos</h2>
            
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Datos de Contacto */}
              <Card>
                <CardContent className="p-8">
                  <h3 className="text-2xl font-semibold mb-6">Información de Contacto</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Dirección</p>
                        <p className="text-muted-foreground">{settings.address}</p>
                        <Badge variant="secondary" className="mt-1">
                          CP: {settings.zipCode}
                        </Badge>
                      </div>
                    </div>

                    {settings.phoneNumber && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">Teléfono</p>
                          <p className="text-muted-foreground">{settings.phoneNumber}</p>
                        </div>
                      </div>
                    )}

                    {settings.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">Email</p>
                          <p className="text-muted-foreground">{settings.email}</p>
                        </div>
                      </div>
                    )}

                    {settings.whatsapp && (
                      <div className="flex items-center gap-3">
                        <MessageCircle className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">WhatsApp</p>
                          <p className="text-muted-foreground">{settings.whatsapp}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Redes Sociales */}
                  {settings.socialMedia && Object.keys(settings.socialMedia).length > 0 && (
                    <div className="mt-8">
                      <h4 className="font-semibold mb-4">Síguenos en</h4>
                      <div className="flex gap-4">
                        {settings.socialMedia.facebook && (
                          <a
                            href={settings.socialMedia.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 border rounded-full hover:bg-accent transition-colors"
                          >
                            <Facebook className="h-5 w-5" />
                          </a>
                        )}
                        {settings.socialMedia.instagram && (
                          <a
                            href={settings.socialMedia.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 border rounded-full hover:bg-accent transition-colors"
                          >
                            <Instagram className="h-5 w-5" />
                          </a>
                        )}
                        {settings.socialMedia.twitter && (
                          <a
                            href={settings.socialMedia.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 border rounded-full hover:bg-accent transition-colors"
                          >
                            <Twitter className="h-5 w-5" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Mapa */}
              <Card>
                <CardContent className="p-8">
                  <h3 className="text-2xl font-semibold mb-6">Ubicación</h3>
                  <div className="aspect-video rounded-lg overflow-hidden border">
                    <iframe
                      src={mapUrl}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Mapa de ubicación"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Iframe personalizado */}
      {settings.iframeUrl && (
        <section className="py-16 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-center mb-12">Explora más</h2>
              <div className="aspect-video rounded-lg overflow-hidden border shadow-lg">
                <iframe
                  src={settings.iframeUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  title="Contenido integrado"
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Horarios de Atención */}
      {settings.schedule && settings.schedule.dias && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-center mb-12">Horarios de Atención</h2>
              
              <Card>
                <CardContent className="p-8">
                  <div className="grid gap-4 md:grid-cols-2">
                    {settings.schedule.dias.map((dia: ScheduleDay) => (
                      <div key={dia.dia} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{dia.dia}</span>
                        </div>
                        <div>
                          {dia.abierto ? (
                            <Badge variant="default">
                              {(dia.horarios[0]) || "Abierto"}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Cerrado</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
