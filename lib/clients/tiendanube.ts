import { TokenBucket } from 'limiter';

import { getApiUrl, getTiendanubeConfig } from '@/lib/config/integrations';
import { logger } from '@/lib/utils/logger';

type TiendanubeHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type StoreRateLimitState = {
  bucket: TokenBucket;
  pending: Promise<void>;
};

const storeLimiters = new Map<string, StoreRateLimitState>();

function getStoreLimiter(storeId: string): StoreRateLimitState {
  const existing = storeLimiters.get(storeId);
  if (existing) return existing;

  const created: StoreRateLimitState = {
    bucket: new TokenBucket({
      bucketSize: 40,
      tokensPerInterval: 2,
      interval: 'second',
    }),
    pending: Promise.resolve(),
  };

  storeLimiters.set(storeId, created);
  return created;
}

async function removeStoreToken(storeId: string): Promise<void> {
  const limiter = getStoreLimiter(storeId);
  const next = limiter.pending.then(async () => {
    await limiter.bucket.removeTokens(1);
  });

  limiter.pending = next.catch(() => undefined);
  await next;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeRetryDelayFromHeaders(headers: Headers): number | null {
  const limit = Number(headers.get('x-rate-limit-limit'));
  const remaining = Number(headers.get('x-rate-limit-remaining'));
  const resetMs = Number(headers.get('x-rate-limit-reset'));

  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || !Number.isFinite(resetMs)) {
    return null;
  }

  const used = Math.max(0, limit - remaining);
  if (used <= 0) return null;

  return Math.max(250, Math.ceil(resetMs / used));
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function withStorePrefix(endpoint: string): string {
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (normalized.includes('{store_id}')) {
    return normalized;
  }

  return `/{store_id}${normalized}`;
}

export class TiendanubeClient {
  private storeId: string;
  private accessToken: string;
  private config = getTiendanubeConfig();

  constructor(params: { storeId: string; accessToken: string }) {
    this.storeId = params.storeId;
    this.accessToken = params.accessToken;

    if (!this.config.userAgent) {
      throw new Error('TIENDANUBE_USER_AGENT es requerido');
    }
  }

  private async apiRequest<T>(
    method: TiendanubeHttpMethod,
    endpoint: string,
    options: {
      params?: Record<string, string>;
      body?: unknown;
    } = {}
  ): Promise<T> {
    const url = getApiUrl('tiendanube', withStorePrefix(endpoint), {
      store_id: this.storeId,
      ...(options.params || {}),
    });

    const headers: Record<string, string> = {
      Authentication: `bearer ${this.accessToken}`,
      'User-Agent': this.config.userAgent!,
      Accept: 'application/json',
    };

    const hasBody = options.body !== undefined;
    const body = hasBody ? JSON.stringify(options.body) : undefined;

    if (hasBody) {
      headers['Content-Type'] = 'application/json; charset=utf-8';
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        await removeStoreToken(this.storeId);

        const response = await fetch(url, {
          method,
          headers,
          body,
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (response.ok) {
          if (response.status === 204) {
            return undefined as T;
          }

          const text = await safeReadText(response);
          if (!text) {
            return undefined as T;
          }

          return JSON.parse(text) as T;
        }

        const errorText = await safeReadText(response);
        const err = new Error(`Tiendanube API Error ${response.status}: ${errorText}`);

        if (response.status === 429 || response.status >= 500) {
          lastError = err;

          const headerDelay = response.status === 429 ? computeRetryDelayFromHeaders(response.headers) : null;
          const baseDelay = headerDelay ?? this.config.retryDelay * attempt;
          const jitter = Math.floor(Math.random() * 250);

          logger.warn('[TIENDANUBE] Request failed, retrying', {
            storeId: this.storeId,
            endpoint,
            method,
            status: response.status,
            attempt,
            delayMs: baseDelay + jitter,
          });

          if (attempt < this.config.retryAttempts) {
            await sleep(baseDelay + jitter);
            continue;
          }
        }

        throw err;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;

        logger.warn('[TIENDANUBE] Request error', {
          storeId: this.storeId,
          endpoint,
          method,
          attempt,
          error: err.message,
        });

        if (attempt < this.config.retryAttempts) {
          await sleep(this.config.retryDelay * attempt);
          continue;
        }

        throw err;
      }
    }

    throw lastError || new Error('Tiendanube API request failed');
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return this.apiRequest<T>('GET', endpoint, { params });
  }

  async post<T>(endpoint: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    return this.apiRequest<T>('POST', endpoint, { body, params });
  }

  async put<T>(endpoint: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    return this.apiRequest<T>('PUT', endpoint, { body, params });
  }

  async patch<T>(endpoint: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    return this.apiRequest<T>('PATCH', endpoint, { body, params });
  }

  async delete<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return this.apiRequest<T>('DELETE', endpoint, { params });
  }
}

export function createTiendanubeClient(params: { storeId: string; accessToken: string }): TiendanubeClient {
  return new TiendanubeClient(params);
}
