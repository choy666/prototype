"use server";

import { db } from "@/lib/db";
import { businessSettings, BusinessSettings, NewBusinessSettings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Obtener la configuración del negocio (singleton pattern)
export async function getBusinessSettings(): Promise<BusinessSettings | null> {
  try {
    const settings = await db.select().from(businessSettings).limit(1);
    
    if (!settings.length) {
      // Si no hay configuración, crear una por defecto
      await initializeBusinessSettings();
      const newSettings = await db.select().from(businessSettings).limit(1);
      return newSettings[0] || null;
    }
    
    if (settings[0].socialMedia) {
      // Se mantiene socialMedia pero no se necesita procesar aquí
    }
    
    return settings[0];
  } catch (error) {
    console.error("[BUSINESS_SETTINGS] Error getting settings:", error);
    return null;
  }
}

// Inicializar configuración por defecto
async function initializeBusinessSettings(): Promise<void> {
  const defaultSettings: NewBusinessSettings = {
    businessName: "Mi Negocio",
    description: "Descripción de tu negocio. Aquí puedes contar tu historia, misión y valores.",
    zipCode: "1001", // Código postal por defecto (CABA)
    address: "Dirección por defecto, Ciudad, País",
    shippingConfig: {
      freeShippingThreshold: 30000,
      internalShippingCost: 3000,
    },
    purchaseProtected: true,
    schedule: {
      dias: [
        { dia: "Lunes", abierto: true, horarios: ["09:00 - 18:00"] },
        { dia: "Martes", abierto: true, horarios: ["09:00 - 18:00"] },
        { dia: "Miércoles", abierto: true, horarios: ["09:00 - 18:00"] },
        { dia: "Jueves", abierto: true, horarios: ["09:00 - 18:00"] },
        { dia: "Viernes", abierto: true, horarios: ["09:00 - 18:00"] },
        { dia: "Sábado", abierto: false, horarios: [] },
        { dia: "Domingo", abierto: false, horarios: [] },
      ],
    },
    socialMedia: {},
    images: [],
    location: null,
  };

  await db.insert(businessSettings).values(defaultSettings);
}

// Actualizar la configuración del negocio
export async function updateBusinessSettings(
  id: number,
  data: Partial<NewBusinessSettings>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validar datos requeridos
    if (data.businessName !== undefined && !data.businessName?.trim()) {
      return { success: false, error: "El nombre del negocio es requerido" };
    }
    
    if (data.zipCode !== undefined && !data.zipCode?.trim()) {
      return { success: false, error: "El código postal es requerido" };
    }
    
    if (data.address !== undefined && !data.address?.trim()) {
      return { success: false, error: "La dirección es requerida" };
    }

    // Validar configuración de envíos
    if (data.shippingConfig) {
      const config = data.shippingConfig as Record<string, number>;
      // updates.shippingConfig = config;
      if (config.freeShippingThreshold !== undefined && config.freeShippingThreshold < 0) {
        return { success: false, error: "El monto de envío gratis no puede ser negativo" };
      }
      if (config.internalShippingCost !== undefined && config.internalShippingCost < 0) {
        return { success: false, error: "El costo de envío interno no puede ser negativo" };
      }
    }

    await db
      .update(businessSettings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(businessSettings.id, id));

    revalidatePath("/admin/business-settings");
    revalidatePath("/nosotros");
    revalidatePath("/envios");
    
    return { success: true };
  } catch (error) {
    console.error("[BUSINESS_SETTINGS] Error updating:", error);
    return { success: false, error: "Error al actualizar la configuración" };
  }
}

// Obtener configuración completa para envíos (CP y costos en una sola query)
export async function getBusinessShippingConfig(): Promise<{
  zipCode: string;
  freeShippingThreshold: number;
  internalShippingCost: number;
} | null> {
  try {
    const settings = await db
      .select({
        zipCode: businessSettings.zipCode,
        shippingConfig: businessSettings.shippingConfig,
      })
      .from(businessSettings)
      .limit(1);
    
    if (!settings[0]) return null;
    
    return {
      zipCode: settings[0].zipCode,
      freeShippingThreshold: (settings[0].shippingConfig as Record<string, number>)?.freeShippingThreshold || 30000,
      internalShippingCost: (settings[0].shippingConfig as Record<string, number>)?.internalShippingCost || 3000,
    };
  } catch (error) {
    console.error("[BUSINESS_SETTINGS] Error getting shipping config:", error);
    return null;
  }
}

// Obtener configuración de envíos internos
export async function getShippingConfig(): Promise<{
  freeShippingThreshold: number;
  internalShippingCost: number;
} | null> {
  try {
    const settings = await db
      .select({ shippingConfig: businessSettings.shippingConfig })
      .from(businessSettings)
      .limit(1);
    
    return settings[0]?.shippingConfig as {
      freeShippingThreshold: number;
      internalShippingCost: number;
    } || null;
  } catch (error) {
    console.error("[BUSINESS_SETTINGS] Error getting shipping config:", error);
    return null;
  }
}

// Obtener información de contacto para mostrar en el frontend
export async function getBusinessContactInfo(): Promise<{
  phoneNumber?: string;
  email?: string;
  whatsapp?: string;
  address: string;
  businessName: string;
  zipCode: string;
  description?: string | null;
  purchaseProtected?: boolean;
  schedule?: Record<string, unknown>;
  socialMedia?: Record<string, string>;
  images?: Array<{url: string, alt?: string}>;
  location?: Record<string, string>;
} | null> {
  try {
    const settings = await db
      .select({
        phoneNumber: businessSettings.phoneNumber,
        email: businessSettings.email,
        whatsapp: businessSettings.whatsapp,
        address: businessSettings.address,
        businessName: businessSettings.businessName,
        zipCode: businessSettings.zipCode,
        description: businessSettings.description,
        purchaseProtected: businessSettings.purchaseProtected,
        schedule: businessSettings.schedule,
        socialMedia: businessSettings.socialMedia,
        images: businessSettings.images,
        location: businessSettings.location,
      })
      .from(businessSettings)
      .limit(1);
    
    if (!settings[0]) return null;
    
    return {
      phoneNumber: settings[0].phoneNumber || undefined,
      email: settings[0].email || undefined,
      whatsapp: settings[0].whatsapp || undefined,
      address: settings[0].address,
      businessName: settings[0].businessName,
      zipCode: settings[0].zipCode,
      description: settings[0].description,
      purchaseProtected: settings[0].purchaseProtected,
      schedule: settings[0].schedule as Record<string, unknown> || undefined,
      socialMedia: (settings[0].socialMedia as Record<string, string>) || undefined,
      images: settings[0].images as Array<{url: string, alt?: string}>,
      location: settings[0].location as Record<string, string>,
    };
  } catch (error) {
    console.error("[BUSINESS_SETTINGS] Error getting contact info:", error);
    return null;
  }
}

// Verificar si un envío es interno (mismo código postal)
export async function isInternalShipping(zipCode: string): Promise<boolean> {
  const businessShippingConfig = await getBusinessShippingConfig();
  return zipCode === businessShippingConfig?.zipCode;
}
