import { db } from '@/lib/db';
import { tiendanubeStores } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import crypto from 'crypto';

interface TiendanubeClientOptions {
  storeId: string;
  accessToken?: string;
}

export class TiendanubeClient {
  private storeId: string;
  private accessToken: string | null;
  private baseUrl: string;
  private userAgent: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(options: TiendanubeClientOptions) {
    this.storeId = options.storeId;
    this.accessToken = options.accessToken || null;
    
    // Configuración de la API
    this.baseUrl = process.env.TIENDANUBE_API_BASE || 'https://api.tiendanube.com/v1';
    this.userAgent = process.env.TIENDANUBE_USER_AGENT || 'MyApp/1.0';
    this.timeout = 30000;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  private async ensureAccessToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    // Obtener token cifrado de la base de datos
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, this.storeId),
    });

    if (!store) {
      throw new Error(`Tienda ${this.storeId} no encontrada`);
    }

    if (store.status !== 'connected') {
      throw new Error(`Tienda ${this.storeId} no está conectada`);
    }

    // Descifrar el token
    if (!process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY) {
      throw new Error('Token encryption key no configurada');
    }

    try {
      const decipher = crypto.createDecipher('aes-256-cbc', process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY || '');
      let decrypted = decipher.update(store.accessTokenEncrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      this.accessToken = decrypted;
      return this.accessToken;
    } catch (error) {
      logger.error('Error descifrando token de acceso', {
        storeId: this.storeId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Token de acceso inválido');
    }
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: unknown
  ): Promise<T> {
    const token = await this.ensureAccessToken();
    const url = `${this.baseUrl}${path}`;

    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
      'User-Agent': this.userAgent,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // Algunos endpoints retornan 204 sin contenido
      if (response.status === 204) {
        return null as T;
      }

      return await response.json();
    } catch (error) {
      logger.error('Error en request a API Tiendanube', {
        method,
        path,
        storeId: this.storeId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Métodos de la API
  async get<T>(path: string): Promise<T> {
    return this.makeRequest<T>('GET', path);
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    return this.makeRequest<T>('POST', path, data);
  }

  async put<T>(path: string, data?: unknown): Promise<T> {
    return this.makeRequest<T>('PUT', path, data);
  }

  async delete<T>(path: string): Promise<T> {
    return this.makeRequest<T>('DELETE', path);
  }

  // Métodos específicos de productos
  async getProducts(params?: { limit?: number; page?: number }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.get<unknown>(`/products${query ? '?' + query : ''}`);
  }

  async getProduct(productId: string) {
    return this.get<unknown>(`/products/${productId}`);
  }

  async createProduct(productData: unknown) {
    return this.post<unknown>('/products', productData);
  }

  async updateProduct(productId: string, productData: unknown) {
    return this.put<unknown>(`/products/${productId}`, productData);
  }

  async deleteProduct(productId: string) {
    return this.delete<unknown>(`/products/${productId}`);
  }

  // Métodos de variantes
  async updateVariant(productId: string, variantId: string, variantData: unknown) {
    return this.put<unknown>(`/products/${productId}/variants/${variantId}`, variantData);
  }

  // Métodos de órdenes
  async getOrders(params?: { limit?: number; page?: number; status?: string }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.get<unknown>(`/orders${query ? '?' + query : ''}`);
  }

  async getOrder(orderId: string) {
    return this.get<unknown>(`/orders/${orderId}`);
  }

  // Métodos de clientes
  async getCustomers(params?: { limit?: number; page?: number }) {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return this.get<unknown>(`/customers${query ? '?' + query : ''}`);
  }

  async getCustomer(customerId: string) {
    return this.get<unknown>(`/customers/${customerId}`);
  }

  // Webhooks
  async getWebhooks() {
    return this.get<unknown>('/webhooks');
  }

  async createWebhook(webhookData: { url: string; events: string[] }) {
    return this.post<unknown>('/webhooks', webhookData);
  }

  async deleteWebhook(webhookId: string) {
    return this.delete<unknown>(`/webhooks/${webhookId}`);
  }

  // Store info
  async getStore() {
    return this.get<unknown>(`/store/${this.storeId}`);
  }
}

// Función helper para crear un cliente autenticado
export async function createClientForStore(storeId: string): Promise<TiendanubeClient> {
  return new TiendanubeClient({ storeId });
}

// Función para crear un cliente con token específico (útil en OAuth callback)
export function createClientWithToken(storeId: string, accessToken: string): TiendanubeClient {
  return new TiendanubeClient({ storeId, accessToken });
}
