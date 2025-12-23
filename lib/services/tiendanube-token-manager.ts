// lib/services/tiendanube-token-manager.ts
import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export interface TokenStatus {
  valid: boolean;
  needsReauth: boolean;
  lastChecked: Date;
  error?: string;
}

class TiendanubeTokenManager {
  private static instance: TiendanubeTokenManager;
  private tokenCache = new Map<string, TokenStatus>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  static getInstance(): TiendanubeTokenManager {
    if (!this.instance) {
      this.instance = new TiendanubeTokenManager();
    }
    return this.instance;
  }

  async validateToken(storeId: string): Promise<TokenStatus> {
    // Verificar cache
    const cached = this.tokenCache.get(storeId);
    if (cached && Date.now() - cached.lastChecked.getTime() < this.CACHE_TTL) {
      return cached;
    }

    try {
      // Obtener token de BD
      const store = await db.query.tiendanubeStores.findFirst({
        where: eq(tiendanubeStores.storeId, storeId)
      });

      if (!store) {
        const status: TokenStatus = {
          valid: false,
          needsReauth: true,
          lastChecked: new Date(),
          error: 'Store not found'
        };
        this.tokenCache.set(storeId, status);
        return status;
      }

      // Verificar token con API
      const response = await fetch(`https://api.tiendanube.com/v1/${storeId}/store`, {
        headers: {
          'Authorization': `Bearer ${store.accessTokenEncrypted}`,
          'Content-Type': 'application/json'
        }
      });

      const status: TokenStatus = {
        valid: response.ok,
        needsReauth: !response.ok,
        lastChecked: new Date(),
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };

      // Si el token es inválido, marcar en BD
      if (!response.ok) {
        await db.update(tiendanubeStores)
          .set({ 
            status: 'needs_reauth',
            updatedAt: new Date()
          })
          .where(eq(tiendanubeStores.storeId, storeId));
      }

      this.tokenCache.set(storeId, status);
      return status;

    } catch (error) {
      const status: TokenStatus = {
        valid: false,
        needsReauth: true,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      this.tokenCache.set(storeId, status);
      return status;
    }
  }

  async handleAuthError(storeId: string, error: { status?: number; message?: string } | Error): Promise<boolean> {
    // Detectar errores de autenticación
    const status = error instanceof Error ? undefined : error.status;
    const message = error instanceof Error ? error.message : error.message;
    
    if (status === 401 || message?.includes('401') || message?.includes('Unauthorized')) {
      // Marcar como necesita reautenticación
      await db.update(tiendanubeStores)
        .set({ 
          status: 'needs_reauth',
          updatedAt: new Date()
        })
        .where(eq(tiendanubeStores.storeId, storeId));

      // Invalidar cache
      this.tokenCache.delete(storeId);

      // Notificar al admin (opcional - implementar después)
      console.warn(`[Tiendanube] Store ${storeId} needs reauthentication`);

      return true;
    }
    return false;
  }

  async isStoreNeedingReauth(storeId: string): Promise<boolean> {
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, storeId)
    });
    return store?.status === 'needs_reauth';
  }

  clearCache(storeId?: string): void {
    if (storeId) {
      this.tokenCache.delete(storeId);
    } else {
      this.tokenCache.clear();
    }
  }
}

export const tiendanubeTokenManager = TiendanubeTokenManager.getInstance();
