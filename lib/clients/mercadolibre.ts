/**
 * Cliente API de Mercado Libre - Singleton Pattern
 * Centraliza todas las llamadas a la API de ML con configuración dinámica
 */

import { getMercadoLibreConfig, getApiUrl, validateConfig, PAGINATION } from '@/lib/config/integrations';
import { logger } from '@/lib/utils/logger';

interface MLTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}

interface MLApiResponse<T = unknown> {
  data: T[];
  paging: {
    total: number;
    limit: number;
    offset: number;
  };
}

class MercadoLibreClient {
  private static instance: MercadoLibreClient | null = null;
  private tokens: MLTokens | null = null;
  private tokenExpiry: number = 0;
  private config = getMercadoLibreConfig();
  private isConfigured: boolean = false;

  private constructor() {
    // Validar configuración solo si estamos en un entorno que la requiere
    try {
      const validation = validateConfig();
      this.isConfigured = validation.isValid;
      if (!validation.isValid) {
        logger.warn('MercadoLibre client not properly configured', { 
          errors: validation.errors 
        });
      }
    } catch (error) {
      logger.warn('Failed to validate MercadoLibre configuration', { error });
      this.isConfigured = false;
    }
  }

  static getInstance(): MercadoLibreClient {
    if (!MercadoLibreClient.instance) {
      MercadoLibreClient.instance = new MercadoLibreClient();
    }
    return MercadoLibreClient.instance;
  }

  /**
   * Verificar si el cliente está configurado correctamente
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Obtener instancia solo si está configurada
   */
  static tryGetInstance(): MercadoLibreClient | null {
    const instance = MercadoLibreClient.getInstance();
    return instance.isReady() ? instance : null;
  }

  /**
   * Obtener tokens de OAuth
   */
  async getTokens(): Promise<MLTokens> {
    // Si tenemos tokens válidos, retornarlos
    if (this.tokens && Date.now() < this.tokenExpiry) {
      return this.tokens;
    }

    // Obtener nuevos tokens usando refresh token o client credentials
    const url = getApiUrl('mercadolibre', '/oauth/token');
    
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.appId!,
      client_secret: this.config.clientSecret!,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Error getting ML tokens', { status: response.status, error });
      throw new Error(`Error ${response.status}: ${error}`);
    }

    const tokens: MLTokens = await response.json();
    this.tokens = tokens;
    this.tokenExpiry = Date.now() + (tokens.expiresIn * 1000) - 60000; // 1 min antes de expirar

    logger.info('ML tokens obtained successfully', {
      expiresIn: tokens.expiresIn,
      scope: tokens.scope,
    });

    return tokens;
  }

  /**
   * Obtener access token válido
   */
  async getAccessToken(): Promise<string> {
    const tokens = await this.getTokens();
    return tokens.accessToken;
  }

  /**
   * Hacer una llamada a la API de ML con retry automático
   */
  private async apiRequest<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    params?: Record<string, string>
  ): Promise<T> {
    const url = getApiUrl('mercadolibre', endpoint, params);
    const accessToken = await this.getAccessToken();

    // Configurar headers por defecto
    const defaultHeaders = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'PrototypeMarketplace/1.0',
    };

    // Intentar la petición con retry
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...defaultHeaders,
            ...options.headers,
          },
          signal: AbortSignal.timeout(this.config.timeout),
        });

        // Si es 401 (unauthorized), intentar refresh de tokens
        if (response.status === 401 && attempt === 1) {
          logger.warn('Token expired, refreshing...');
          this.tokens = null;
          this.tokenExpiry = 0;
          continue; // Reintentar con nuevos tokens
        }

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`ML API Error ${response.status}: ${error}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;
        logger.warn(`ML API request failed (attempt ${attempt}/${this.config.retryAttempts})`, {
          endpoint,
          error: lastError.message,
        });

        if (attempt < this.config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        }
      }
    }

    throw lastError || new Error('ML API request failed after all retries');
  }

  /**
   * GET request con paginación
   */
  async get<T = unknown>(
    endpoint: string,
    params?: Record<string, string>,
    options: {
      limit?: number;
      offset?: number;
      allPages?: boolean;
    } = {}
  ): Promise<T[]> {
    const { limit = PAGINATION.defaultLimit, offset = PAGINATION.defaultOffset, allPages = false } = options;
    
    const queryParams: Record<string, string> = {
      ...params,
      limit: limit.toString(),
      offset: offset.toString(),
    };

    const response = await this.apiRequest<MLApiResponse<T>>(endpoint, {}, queryParams);
    
    if (!allPages) {
      return response.data;
    }

    // Obtener todas las páginas si se solicita
    const allItems: T[] = [...response.data];
    const total = response.paging.total;
    let currentOffset = offset + limit;

    while (currentOffset < total) {
      const nextPage = await this.apiRequest<MLApiResponse<T>>(endpoint, {}, {
        ...params,
        limit: limit.toString(),
        offset: currentOffset.toString(),
      });
      
      allItems.push(...nextPage.data);
      currentOffset += limit;
    }

    return allItems;
  }

  /**
   * POST request
   */
  async post<T = unknown>(
    endpoint: string,
    data?: unknown,
    params?: Record<string, string>
  ): Promise<T> {
    return this.apiRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }, params);
  }

  /**
   * PUT request
   */
  async put<T = unknown>(
    endpoint: string,
    data?: unknown,
    params?: Record<string, string>
  ): Promise<T> {
    return this.apiRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }, params);
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    return this.apiRequest<T>(endpoint, {
      method: 'DELETE',
    }, params);
  }

  /**
   * Subir archivo (multipart/form-data)
   */
  async uploadFile<T = unknown>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, string>
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const url = getApiUrl('mercadolibre', endpoint);
    const accessToken = await this.getAccessToken();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      body: formData,
      signal: AbortSignal.timeout(this.config.timeout * 2), // Más tiempo para uploads
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upload failed ${response.status}: ${error}`);
    }

    return response.json();
  }

  /**
   * Métodos específicos de ML usando el cliente genérico
   */
  
  async getUser(userId: string) {
    return this.get(`/users/${userId}`);
  }

  async getItem(itemId: string) {
    return this.get(`/items/${itemId}`);
  }

  async getCategories() {
    return this.get('/sites/{site_id}/categories', { site_id: this.config.siteId });
  }

  async getCategory(categoryId: string) {
    return this.get(`/categories/${categoryId}`);
  }

  async getCategoryAttributes(categoryId: string) {
    return this.get(`/categories/${categoryId}/attributes`);
  }

  async calculateShipping(itemId: string, zipcode: string, dimensions: Record<string, unknown>) {
    return this.post(`/shipping_options/${itemId}`, {
      zipcode,
      dimensions,
      local_pickup: false,
      logistic_type: 'drop_off',
    });
  }

  async getShipment(shipmentId: string) {
    return this.get(`/shipments/${shipmentId}`);
  }

  async createOrder(data: Record<string, unknown>) {
    return this.post('/orders', data);
  }

  async getOrders(params?: {
    seller?: string;
    buyer?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown> {
    const queryParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams[key] = value.toString();
        }
      });
    }
    return this.get('/orders/search', queryParams);
  }

  async getOrder(orderId: string) {
    return this.get(`/orders/${orderId}`);
  }

  async updateOrder(orderId: string, data: Record<string, unknown>) {
    return this.put(`/orders/${orderId}`, data);
  }

  async getQuestions(params?: {
    seller_id?: string;
    item_id?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown> {
    const queryParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams[key] = value.toString();
        }
      });
    }
    return this.get('/questions/search', queryParams);
  }

  async answerQuestion(questionId: string, text: string) {
    return this.post(`/answers/${questionId}`, { text });
  }
}

// Exportar la instancia singleton
export const mlClient = MercadoLibreClient.getInstance();
export default mlClient;
