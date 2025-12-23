// lib/services/tiendanube-oauth-handler.ts
// Basado en documentación oficial de Tiendanube OAuth

import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { decryptString } from '@/lib/utils/encryption';

export class TiendanubeOAuthHandler {
  // Verificar si la tienda está realmente conectada
  static async isStoreActuallyConnected(storeId: string): Promise<boolean> {
    try {
      const store = await db.query.tiendanubeStores.findFirst({
        where: eq(tiendanubeStores.storeId, storeId)
      });

      if (!store) {
        return false;
      }

      // Endpoint oficial para verificar conexión
      const decryptedToken = decryptString(store.accessTokenEncrypted);
      const response = await fetch(`https://api.tiendanube.com/2025-03/${storeId}/store`, {
        headers: {
          'Authentication': `bearer ${decryptedToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Technocat-Integration/1.0 (contact@technocat.com)'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('[Tiendanube OAuth] Error verificando conexión:', error);
      return false;
    }
  }

  // Verificar si el token es válido según la documentación oficial
  static async validateTokenOfficially(storeId: string): Promise<{
    valid: boolean;
    needsReconnect: boolean;
    storeActive: boolean;
  }> {
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, storeId)
    });

    if (!store) {
      return {
        valid: false,
        needsReconnect: true,
        storeActive: false
      };
    }

    try {
      // Usar endpoint oficial de la API
      const response = await fetch(`https://api.tiendanube.com/v1/${storeId}`, {
        headers: {
          'Authorization': `Bearer ${store.accessTokenEncrypted}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        // Según docs: 401 = app no instalada o token revocado
        return {
          valid: false,
          needsReconnect: true,
          storeActive: false
        };
      }

      if (response.status === 404) {
        // Store no existe o fue eliminado
        return {
          valid: false,
          needsReconnect: true,
          storeActive: false
        };
      }

      if (response.ok) {
        const storeData = await response.json();
        
        // Verificar que el store está activo
        return {
          valid: true,
          needsReconnect: false,
          storeActive: !storeData.disabled
        };
      }

      return {
        valid: false,
        needsReconnect: true,
        storeActive: false
      };

    } catch (error) {
      console.error('[Tiendanube OAuth] Error validando token:', error);
      return {
        valid: false,
        needsReconnect: true,
        storeActive: false
      };
    }
  }

  // Limpiar tienda desconectada
  static async cleanDisconnectedStore(storeId: string): Promise<void> {
    await db.update(tiendanubeStores)
      .set({ 
        status: 'disconnected',
        updatedAt: new Date()
      })
      .where(eq(tiendanubeStores.storeId, storeId));
  }

  // Marcar como necesita reconexión
  static async markForReconnection(storeId: string): Promise<void> {
    await db.update(tiendanubeStores)
      .set({ 
        status: 'needs_reauth',
        updatedAt: new Date()
      })
      .where(eq(tiendanubeStores.storeId, storeId));
  }
}
