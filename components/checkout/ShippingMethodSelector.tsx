'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';

import { MLShippingMethod } from '@/lib/types/shipping';
import { buildLocalCartId, QuoteItemInput } from '@/lib/utils/shipping-quote';

interface ShippingMethodSelectorProps {
  selectedMethod?: MLShippingMethod | null;
  onMethodSelect: (method: MLShippingMethod) => void;
  items: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
    discount?: number;
  }>;
  zipcode: string;
  subtotal: number;
}

type QuoteMeta = {
  source?: string | null;
  expiresAt?: string | null;
  ttlSeconds?: number | null;
  cartId?: string | null;
  quoteKey?: string | null;
  fromCache?: boolean;
};

interface RawQuoteOption {
  id: string | number;
  name: string;
  cost: number;
  code?: string;
  estimated_delivery?: string;
  carrier_name?: string;
  carrier?: string;
  type?: string;
  description?: string;
  shipping_mode?: string;
  quoteKey?: string;
  cartId?: string;
  quoteSource?: string;
  quoteExpiresAt?: string;
  ttlSeconds?: number;
}

const isLocalOption = (option: RawQuoteOption) =>
  option.type === 'local' ||
  option.code === 'pickup' ||
  option.id === 'local-pickup' ||
  option.carrier_name === 'Local';

const convertOptionToMethod = (
  option: RawQuoteOption,
  fallbackMeta?: QuoteMeta
): MLShippingMethod => {
  const type = isLocalOption(option) ? 'internal' : 'tiendanube';
  const carrierLabel = option.carrier ?? option.carrier_name;
  const meta: QuoteMeta = {
    source: option.quoteSource ?? fallbackMeta?.source ?? null,
    expiresAt: option.quoteExpiresAt ?? fallbackMeta?.expiresAt ?? null,
    ttlSeconds: option.ttlSeconds ?? fallbackMeta?.ttlSeconds ?? null,
    cartId: option.cartId ?? fallbackMeta?.cartId ?? null,
    quoteKey: option.quoteKey ?? fallbackMeta?.quoteKey ?? null,
    fromCache: fallbackMeta?.fromCache ?? false,
  };

  const descriptionParts = [
    option.estimated_delivery,
    carrierLabel ? `• ${carrierLabel}` : null,
  ].filter(Boolean);

  return {
    shipping_method_id: option.id.toString(),
    name: option.name,
    cost: option.cost,
    description: option.description || descriptionParts.join(' ') || '',
    shipping_mode: type === 'internal' ? 'custom' : 'tiendanube',
    deliver_to: 'address',
    type,
    estimated_delivery: undefined,
    quote_key: meta.quoteKey || undefined,
    cart_id: meta.cartId || undefined,
    source: meta.source || undefined,
    ttl_seconds: meta.ttlSeconds ?? undefined,
    expires_at: meta.expiresAt || undefined,
    carrier_name: carrierLabel,
  };
};

const extractMetaFromMethods = (
  methods: MLShippingMethod[]
): QuoteMeta | null => {
  const tiendanubeMethod = methods.find(
    (method) => method.type === 'tiendanube' && method.quote_key
  );
  if (!tiendanubeMethod) {
    return null;
  }

  return {
    source: tiendanubeMethod.source ?? null,
    expiresAt: tiendanubeMethod.expires_at ?? null,
    ttlSeconds: tiendanubeMethod.ttl_seconds ?? null,
    cartId: tiendanubeMethod.cart_id ?? null,
    quoteKey: tiendanubeMethod.quote_key ?? null,
    fromCache: false,
  };
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

const formatSeconds = (seconds?: number | null) => {
  if (seconds === undefined || seconds === null) return null;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
};

export function ShippingMethodSelector({
  selectedMethod,
  onMethodSelect,
  items,
  zipcode,
  subtotal,
}: ShippingMethodSelectorProps) {
  const [shippingMethods, setShippingMethods] = useState<MLShippingMethod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [quoteMeta, setQuoteMeta] = useState<QuoteMeta | null>(null);

  const normalizedItems = useMemo<QuoteItemInput[]>(() => {
    return items.map((item) => {
      const price =
        item.discount && item.discount > 0
          ? item.price * (1 - item.discount / 100)
          : item.price;
      return {
        id: item.id,
        quantity: item.quantity,
        price,
      };
    });
  }, [items]);

  const cartId = useMemo(() => {
    if (!zipcode || normalizedItems.length === 0) {
      return null;
    }
    return buildLocalCartId(zipcode, normalizedItems);
  }, [zipcode, normalizedItems]);

  const handleMethodSelect = (method: MLShippingMethod) => {
    onMethodSelect(method);
  };

  useEffect(() => {
    if (!zipcode || !cartId || normalizedItems.length === 0) {
      setShippingMethods([]);
      setQuoteMeta(null);
      return;
    }

    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const win = window as Window & { __tnbShippingFetches?: Set<string> };
      const guardKey = `tnb-shipping-${cartId}`;

      if (!win.__tnbShippingFetches) {
        win.__tnbShippingFetches = new Set<string>();
      }

      if (win.__tnbShippingFetches.has(guardKey)) {
        return;
      }

      win.__tnbShippingFetches.add(guardKey);
    }

    let cancelled = false;

    const fetchShippingMethods = async () => {
      setIsLoading(true);
      setIsFallback(false);
      setSource(null);
      setQuoteMeta(null);

      try {
        const cacheHit = await fetchFromCache();
        if (cancelled) return;
        if (cacheHit) return;
        await calculateAndFetch();
      } catch (error) {
        if (!cancelled) {
          console.error('[ShippingMethodSelector] Error fetching shipping methods:', error);
          toast.error(
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar los métodos de envío'
          );
          setShippingMethods([]);
          setIsFallback(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    const fetchFromCache = async () => {
      try {
        const cacheResponse = await fetch(
          `/api/shipping/tiendanube?cartId=${encodeURIComponent(cartId)}`
        );

        if (cacheResponse.status === 404) {
          return false;
        }

        if (!cacheResponse.ok) {
          const errorData = await cacheResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'Error leyendo la caché de Tiendanube');
        }

        const data = await cacheResponse.json();
        if (cancelled) return true;

        const meta: QuoteMeta = {
          source: data.source ?? null,
          expiresAt: data.expiresAt ?? null,
          ttlSeconds: data.ttlSeconds ?? null,
          cartId: data.cartId ?? cartId,
          quoteKey: data.quoteKey ?? null,
          fromCache: true,
        };

        const converted: MLShippingMethod[] = (data.options || []).map((option: RawQuoteOption) =>
          convertOptionToMethod(option, meta)
        );

        setShippingMethods(converted);
        setIsFallback(converted.every((method: MLShippingMethod) => method.type !== 'tiendanube'));
        setSource(meta.source || null);
        setQuoteMeta(meta);

        return true;
      } catch (error) {
        console.error('[ShippingMethodSelector] Error leyendo caché:', error);
        return false;
      }
    };

    const calculateAndFetch = async () => {
      const response = await fetch('/api/shipping/unified', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerZip: zipcode,
          items: normalizedItems.map((item) => ({
            id: item.id.toString(),
            quantity: item.quantity,
            price: item.price,
          })),
          subtotal,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error calculando los métodos de envío');
      }

      const data = await response.json();
      if (cancelled) return;

      const converted: MLShippingMethod[] = (data.options || []).map((option: RawQuoteOption) =>
        convertOptionToMethod(option)
      );

      setShippingMethods(converted);
      setIsFallback(converted.every((method: MLShippingMethod) => method.type !== 'tiendanube'));

      const meta = extractMetaFromMethods(converted);
      if (meta) {
        setQuoteMeta(meta);
        setSource(meta.source || null);
      } else {
        setQuoteMeta(null);
        setSource(null);
      }
    };

    fetchShippingMethods();

    return () => {
      cancelled = true;
    };
  }, [zipcode, cartId, normalizedItems, subtotal]);

  const statusMessage = (() => {
    if (quoteMeta) {
      const sourceLabel =
        quoteMeta.source === 'tiendanube'
          ? 'Cotización oficial de Tiendanube'
          : 'Cotización calculada localmente';
      const freshness = quoteMeta.fromCache ? ' (cache)' : ' (recalculada)';
      const ttlLabel = formatSeconds(quoteMeta.ttlSeconds);
      const expiryLabel = !ttlLabel && quoteMeta.expiresAt
        ? `expira ${new Date(quoteMeta.expiresAt).toLocaleTimeString('es-AR')}`
        : null;
      const metaPieces = [ttlLabel, expiryLabel].filter(Boolean).join(' • ');

      return `${sourceLabel}${freshness}${metaPieces ? ` • ${metaPieces}` : ''}`;
    }

    if (isFallback) {
      return 'Mostrando métodos locales (fallback).';
    }

    if (source === 'unified_shipping') {
      return 'Mostrando métodos de envío combinados (Mercado Libre + Tiendanube).';
    }

    return 'Mostrando métodos de envío disponibles.';
  })();

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <p className="text-sm text-gray-600">Cargando métodos de envío...</p>
      </div>
    );
  }

  if (shippingMethods.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <p className="text-sm text-gray-600">
          No hay métodos de envío disponibles para este código postal
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Método de Envío</h3>
        <p className="text-sm text-gray-600 mb-4">
          Selecciona cómo quieres recibir tu pedido
        </p>
        <p className="text-xs text-gray-500">{statusMessage}</p>
        {quoteMeta?.quoteKey && (
          <p className="text-[11px] text-gray-400 mt-1">
            quoteKey: <span className="font-mono">{quoteMeta.quoteKey.slice(0, 16)}...</span>
          </p>
        )}
      </div>

      <div className="space-y-3">
        {shippingMethods.map((method: MLShippingMethod, index) => {
          const isSelected =
            selectedMethod?.shipping_method_id === method.shipping_method_id;

          const baseId =
            (typeof method.shipping_method_id !== 'undefined'
              ? method.shipping_method_id.toString()
              : 'no-id') +
            '-' +
            (typeof method.order_priority !== 'undefined'
              ? method.order_priority.toString()
              : index.toString());

          const inputId = `shipping-${baseId}`;

          return (
            <div
              key={baseId}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-gray-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => {
                handleMethodSelect(method);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    id={inputId}
                    name="shipping-method"
                    checked={isSelected}
                    onChange={() => {
                      handleMethodSelect(method);
                    }}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor={inputId}
                    className="font-medium cursor-pointer"
                  >
                    {method.name}
                  </label>
                </div>

                <div className="text-right">
                  {method.cost === 0 ? (
                    <span className="text-green-600 font-semibold">Gratis</span>
                  ) : (
                    <span className="font-semibold">
                      {formatCurrency(method.cost)}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 ml-7">
                <div className="text-xs text-gray-500 space-y-1">
                  <p>{method.description}</p>
                  {method.type === 'internal' && (
                    <p className="text-green-600 font-semibold">
                      ⚡ Entrega en 24 horas hábiles
                    </p>
                  )}
                  {method.carrier_name && (
                    <p>Carrier: {method.carrier_name}</p>
                  )}
                  {method.quote_key && (
                    <p className="font-mono text-[11px] text-gray-400">
                      Quote: {method.quote_key.slice(0, 16)}...
                    </p>
                  )}
                  <p>
                    Modo:{' '}
                    {method.shipping_mode === 'custom'
                      ? 'Local'
                      : method.shipping_mode === 'tiendanube'
                        ? 'Tiendanube'
                        : method.shipping_mode || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedMethod && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Costo de envío:</span>
            <span className="text-sm font-semibold">
              {selectedMethod.cost === 0
                ? 'Gratis'
                : formatCurrency(selectedMethod.cost)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
