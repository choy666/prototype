import { Metadata } from "next";
import React from "react";
import { getBusinessContactInfo } from "@/lib/actions/business-settings";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Mail, MessageCircle, Shield, Clock, Facebook, Instagram, Twitter } from "lucide-react";

interface ScheduleDayLegacy {
  dia: string;
  abierto: boolean;
  horarios: string[];
}

interface ScheduleDay {
  dia: string;
  abierto: boolean;
  horarios: {
    maniana: string;
    tarde: string;
  };
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

  // Migración de datos de horarios si es necesario
  const migrateSchedule = (schedule: unknown): Schedule | undefined => {
    if (!schedule || typeof schedule !== 'object') return undefined;
    
    const scheduleObj = schedule as { dias?: unknown };
    if (!Array.isArray(scheduleObj.dias)) return undefined;
    
    return {
      dias: scheduleObj.dias.map((dia: unknown): ScheduleDay => {
        const diaObj = dia as ScheduleDayLegacy | ScheduleDay;
        // Si horarios es un array (formato antiguo), convertir al nuevo formato
        if (Array.isArray((diaObj as ScheduleDayLegacy).horarios)) {
          return {
            ...diaObj,
            horarios: {
              maniana: (diaObj as ScheduleDayLegacy).horarios[0] || "",
              tarde: ""
            }
          };
        }
        // Si ya tiene el nuevo formato, mantenerlo
        return diaObj as ScheduleDay;
      })
    };
  };

  // Cast to proper types after null check and migration
  const settings = {
    businessName: businessSettings.businessName,
    description: businessSettings.description,
    address: businessSettings.address,
    zipCode: businessSettings.zipCode,
    phoneNumber: businessSettings.phoneNumber,
    email: businessSettings.email,
    whatsapp: businessSettings.whatsapp,
    purchaseProtected: businessSettings.purchaseProtected,
    schedule: migrateSchedule(businessSettings.schedule),
    socialMedia: businessSettings.socialMedia || {},
    images: businessSettings.images || [],
    location: businessSettings.location || {},
    iframeUrl: businessSettings.iframeUrl || null
  };

  
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-primary/80 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              {settings.businessName}
            </h1>
            <p className="text-xl md:text-2xl opacity-90 mb-8">
              Tu tienda de confianza
            </p>
            
            {/* Sección Compra Protegida */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="flex items-center justify-center gap-4 mb-4">
                <Shield className="h-12 w-12 text-white" />
                <h2 className="text-3xl font-bold">Compra Protegida</h2>
              </div>
              <p className="text-lg mb-6 opacity-95">
                Tu seguridad es nuestra prioridad máxima
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="text-3xl mb-2">🔒</div>
                  <h3 className="font-semibold mb-2">Pagos Seguros</h3>
                  <p className="text-sm opacity-90">
                    Transacciones encriptadas y protegidas con los estándares más altos de seguridad
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="text-3xl mb-2">📦</div>
                  <h3 className="font-semibold mb-2">Envío Garantizado</h3>
                  <p className="text-sm opacity-90">
                    Seguimiento en tiempo real y seguro contra pérdida o daño durante el transporte
                  </p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="text-3xl mb-2">↩️</div>
                  <h3 className="font-semibold mb-2">Devolución Fácil</h3>
                  <p className="text-sm opacity-90">
                    30 días para devoluciones. Si no estás conforme, te devolvemos tu dinero
                  </p>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-center gap-2">
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  100% Seguro
                </Badge>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  Soporte 24/7
                </Badge>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  Garantía de Satisfacción
                </Badge>
              </div>
            </div>
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
                  {settings.iframeUrl ? (
                    <div 
                      className="aspect-video rounded-lg overflow-hidden border shadow-lg"
                      dangerouslySetInnerHTML={{ 
                        __html: settings.iframeUrl.replace(
                          /width="[^"]*"/, 
                          'width="100%"'
                        ).replace(
                          /height="[^"]*"/, 
                          'height="100%"'
                        ).replace(
                          /style="([^"]*)"/, 
                          'style="$1 width: 100%; height: 100%; border: 0;"'
                        ) || settings.iframeUrl
                      }}
                    />
                  ) : (
                    <div className="aspect-video rounded-lg overflow-hidden border bg-gray-100 flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <MapPin className="h-12 w-12 mx-auto mb-2" />
                        <p>El mapa no está disponible</p>
                        <p className="text-sm">El administrador aún no ha configurado la ubicación</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

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
                      <div key={dia.dia} className="flex items-start justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <span className="font-medium">{dia.dia}</span>
                        </div>
                        <div className="text-right">
                          {dia.abierto ? (
                            <div className="space-y-1">
                              {dia.horarios.maniana && (
                                <Badge variant="default" className="text-xs">
                                  🌅 {dia.horarios.maniana}
                                </Badge>
                              )}
                              {dia.horarios.tarde && (
                                <Badge variant="default" className="text-xs ml-2">
                                  🌆 {dia.horarios.tarde}
                                </Badge>
                              )}
                              {!dia.horarios.maniana && !dia.horarios.tarde && (
                                <Badge variant="default">
                                  Abierto
                                </Badge>
                              )}
                            </div>
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
