import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { products, mercadolibreProductsSync, categories, ProductVariant } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { logger } from '@/lib/utils/logger';
import { makeAuthenticatedRequest } from '@/lib/auth/mercadolibre';
import { getBusinessShippingConfig } from '@/lib/actions/business-settings';
import {
  validatePrice,
  validateImageAccessibility,
  sanitizeTitle,
} from '@/lib/validations/mercadolibre';
import { validateProductForMLSync } from '@/lib/validations/ml-sync-validation';
import {
  validateListingTypeSelection,
  ListingTypeValidationError,
} from '@/lib/validations/listing-type';
import { resolveStockPolicy, calculateAvailableQuantityForML } from '@/lib/domain/ml-stock';
import {
  getCategoryME2Rules,
  validateDimensionsWithRules,
  validateShippingAttributesWithRules,
  normalizeVariantAttributeCombinations,
  fetchMLAttributeDefinitions,
  type MLAttributeDefinition,
  type NormalizedAttributeCombination,
  type ME2CategoryRules,
} from '@/lib/mercado-envios/me2Rules';

export async function POST(req: NextRequest) {
  let timeoutId: NodeJS.Timeout | null = null;
  let abortController: AbortController | null = null;
  let productId: string | null = null;
  let productIdNum: number | null = null;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    productId = body.productId;

    if (!productId) {
      return NextResponse.json({ error: 'Se requiere el ID del producto' }, { status: 400 });
    }

    productIdNum = parseInt(productId);
    if (isNaN(productIdNum)) {
      return NextResponse.json({ error: 'ID de producto inválido' }, { status: 400 });
    }

    // Configurar timeout de 5 minutos
    abortController = new AbortController();
    timeoutId = setTimeout(
      () => {
        abortController?.abort();
      },
      5 * 60 * 1000
    );

    // Verificar si hay un producto atascado en syncing por más de 5 minutos
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingSync = await db.query.mercadolibreProductsSync.findFirst({
      where: and(
        eq(mercadolibreProductsSync.productId, productIdNum!),
        eq(mercadolibreProductsSync.syncStatus, 'syncing')
      ),
    });

    if (existingSync) {
      if (existingSync.lastSyncAt && existingSync.lastSyncAt < fiveMinutesAgo) {
        // Liberar producto atascado
        await db
          .update(mercadolibreProductsSync)
          .set({
            syncStatus: 'error',
            syncError: 'Timeout: sincronización expirada después de 5 minutos',
          })
          .where(eq(mercadolibreProductsSync.productId, productIdNum!));
      } else {
        return NextResponse.json(
          { error: 'El producto ya está siendo sincronizado' },
          { status: 409 }
        );
      }
    }

    // Verificar límite de intentos
    const currentRecord = await db.query.mercadolibreProductsSync.findFirst({
      where: eq(mercadolibreProductsSync.productId, productIdNum!),
    });

    if (currentRecord && currentRecord.syncAttempts >= 3) {
      await db
        .update(mercadolibreProductsSync)
        .set({
          syncStatus: 'error',
          syncError:
            'Límite de intentos alcanzado (3). Por favor revise la configuración del producto.',
        })
        .where(eq(mercadolibreProductsSync.productId, productIdNum!));
      return NextResponse.json(
        { error: 'Límite de intentos de sincronización alcanzado' },
        { status: 429 }
      );
    }

    // Crear o actualizar registro de sincronización
    await db
      .insert(mercadolibreProductsSync)
      .values({
        productId: productIdNum!,
        syncStatus: 'syncing',
        lastSyncAt: new Date(),
        syncAttempts: currentRecord ? currentRecord.syncAttempts + 1 : 1,
      })
      .onConflictDoUpdate({
        target: mercadolibreProductsSync.productId,
        set: {
          syncStatus: 'syncing',
          lastSyncAt: new Date(),
          syncAttempts: sql`${mercadolibreProductsSync.syncAttempts} + 1`,
          syncError: null,
        },
      });

    // Obtener producto local con variantes
    const localProduct = await db.query.products.findFirst({
      where: eq(products.id, productIdNum!),
      with: {
        variants: true,
      },
    });

    if (!localProduct) {
      throw new MercadoLibreError(
        MercadoLibreErrorCode.CATEGORY_NOT_FOUND,
        'Producto no encontrado'
      );
    }

    if (!localProduct.mlCategoryId) {
      if (timeoutId) clearTimeout(timeoutId);
      return NextResponse.json(
        {
          error:
            'El producto no tiene una categoría de Mercado Libre configurada. Edita el producto y selecciona una categoría oficial antes de sincronizar.',
        },
        { status: 400 }
      );
    }

    if (!localProduct.mlListingTypeId) {
      if (timeoutId) clearTimeout(timeoutId);
      return NextResponse.json(
        {
          error:
            'El producto no tiene un tipo de publicación configurado. Edita el producto y selecciona un tipo válido antes de sincronizar.',
        },
        { status: 400 }
      );
    }

    const numericPrice = Number(localProduct.price);
    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      if (timeoutId) clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'El precio del producto no es válido. Debe ser un número mayor a 0.' },
        { status: 400 }
      );
    }

    const userIdNumber = Number(session.user.id);
    const listingValidationUserId = Number.isNaN(userIdNumber) ? undefined : userIdNumber;

    let listingTypeValidationResult;
    try {
      listingTypeValidationResult = await validateListingTypeSelection({
        userId: listingValidationUserId,
        mlCategoryId: localProduct.mlCategoryId,
        mlListingTypeId: localProduct.mlListingTypeId,
        price: numericPrice,
      });
    } catch (error) {
      if (error instanceof ListingTypeValidationError) {
        if (timeoutId) clearTimeout(timeoutId);
        return NextResponse.json(
          {
            error: error.message,
            source: error.meta?.source,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const listingTypeIdToUse = listingTypeValidationResult.listingTypeRule.id;

    // Obtener atributos de la categoría
    const catalogAttributes = await db.query.categories.findFirst({
      where: eq(categories.mlCategoryId, localProduct.mlCategoryId || 'MLA3530'),
    });
    let catalogAttributeDefinitions: MLAttributeDefinition[] | undefined = undefined;
    if (Array.isArray(catalogAttributes?.attributes)) {
      catalogAttributeDefinitions = (catalogAttributes!.attributes as unknown[])
        .filter((attr): attr is MLAttributeDefinition =>
          Boolean(attr && typeof attr === 'object' && (attr as MLAttributeDefinition).id)
        )
        .map((attr) => ({
          id: attr.id,
          name: attr.name ?? attr.id,
          tags: attr.tags,
          values: attr.values,
        }));
    }
    if (!catalogAttributeDefinitions || catalogAttributeDefinitions.length === 0) {
      catalogAttributeDefinitions = await fetchMLAttributeDefinitions(localProduct.mlCategoryId);
    }
    if (!catalogAttributeDefinitions) {
      catalogAttributeDefinitions = [];
    }
    const me2Rules = await getCategoryME2Rules(localProduct.mlCategoryId);

    // Debug: Verificar datos de la categoría
    console.log('[ML-Sync-Debug] Categoría encontrada:', {
      categoryId: localProduct.mlCategoryId,
      catalogFound: !!catalogAttributes,
      catalogName: catalogAttributes?.name,
      catalogMlId: catalogAttributes?.mlCategoryId,
      hasAttributes: !!(
        (catalogAttributes?.attributes as unknown[]) &&
        (catalogAttributes?.attributes as unknown[]).length > 0
      ),
      attributeCount: ((catalogAttributes?.attributes as unknown[]) || []).length,
      attributes: catalogAttributes?.attributes,
    });

    // Debug: Verificar atributos del producto
    console.log('[ML-Sync-Debug] Atributos del producto:', {
      productId: localProduct.id,
      hasAttributes: !!(
        (localProduct.attributes as unknown[]) && (localProduct.attributes as unknown[]).length > 0
      ),
      attributeCount: ((localProduct.attributes as unknown[]) || []).length,
      attributes: localProduct.attributes,
    });

    // Validar dimensiones y atributos de envío antes de continuar
    const dimensionValidation = validateDimensionsWithRules(
      {
        height: Number(localProduct.height) || 0,
        width: Number(localProduct.width) || 0,
        length: Number(localProduct.length) || 0,
        weight: Number(localProduct.weight) || 0,
      },
      me2Rules
    );

    if (!dimensionValidation.isValid) {
      if (timeoutId) clearTimeout(timeoutId);
      return NextResponse.json(
        {
          error: 'Dimensiones/peso inválidos para Mercado Envíos',
          details: dimensionValidation.warnings,
          missing: dimensionValidation.missing,
        },
        { status: 400 }
      );
    }

    const productShippingAttributes =
      (localProduct as unknown as { shippingAttributes?: Record<string, unknown> | null })
        .shippingAttributes ?? null;

    const shippingValidation = validateShippingAttributesWithRules(
      productShippingAttributes,
      me2Rules
    );

    if (!shippingValidation.isValid) {
      if (timeoutId) clearTimeout(timeoutId);
      return NextResponse.json(
        {
          error: 'Atributos de envío incompletos para Mercado Envíos',
          details: shippingValidation.warnings,
          missing: shippingValidation.missing,
        },
        { status: 400 }
      );
    }

    // Preparar atributos adicionales para variantes
    const hasVariants = localProduct.variants && localProduct.variants.length > 0;

    // Preparar datos para ML
    const mlProductData: {
      title: string;
      category_id: string;
      price: number;
      currency_id: string;
      available_quantity: number;
      buying_mode: string;
      listing_type_id: string;
      condition: string;
      description: string;
      pictures: Array<{ source: string }>;
      video_id?: string;
      attributes: Array<Record<string, unknown>>;
      shipping: Record<string, unknown>;
      variations?: Array<{
        price: number;
        available_quantity: number;
        attribute_combinations: unknown[];
        picture_ids: unknown[];
        seller_custom_field: string;
      }>;
    } = {
      title: (() => {
        try {
          return sanitizeTitle(localProduct.name);
        } catch (sanitizeError) {
          logger.warn('Error sanitizando título, usando original', {
            productId: productIdNum,
            error: sanitizeError instanceof Error ? sanitizeError.message : String(sanitizeError),
          });
          return localProduct.name;
        }
      })(),
      category_id: localProduct.mlCategoryId || 'MLA3530',
      currency_id: localProduct.mlCurrencyId || 'ARS',
      buying_mode: localProduct.mlBuyingMode || 'buy_it_now',
      condition: localProduct.mlCondition || 'new',
      listing_type_id: listingTypeIdToUse,
      description: localProduct.description || '',
      pictures: localProduct.image
        ? [
            {
              source: localProduct.image,
            },
          ]
        : [],
      attributes: mapProductAttributesToML(
        localProduct.attributes as unknown,
        catalogAttributeDefinitions
      ) as Array<Record<string, unknown>>,
      shipping: {}, // Se inicializará después
      price: 0, // Se asignará después
      available_quantity: 0, // Se asignará después
    };

    // Validación completa usando la función dinámica
    const mlValidation = await validateProductForMLSync(
      localProduct,
      catalogAttributes,
      parseInt(session.user.id)
    );

    if (!mlValidation.isValid) {
      if (timeoutId) clearTimeout(timeoutId);
      return NextResponse.json(
        {
          error: 'El producto no cumple los requisitos de Mercado Libre',
          details: mlValidation.errors,
          missingAttributes: mlValidation.missingRequired.map((attr) => ({
            id: attr.id,
            name: attr.name,
            required: attr.tags?.required || false,
          })),
          missingConditional: mlValidation.missingConditional.map((attr) => ({
            id: attr.id,
            name: attr.name,
            allowEmptyReason: true,
            hint: 'Completa el valor o marca la opción “No aplica” usando EMPTY_*_REASON',
          })),
        },
        { status: 400 }
      );
    }

    // Log de advertencias si existen
    if (mlValidation.warnings.length > 0) {
      logger.warn('Advertencias de sincronización ML', {
        productId: productIdNum,
        warnings: mlValidation.warnings,
      });
    }

    // Validar precio
    const priceValidation = validatePrice(
      localProduct.price,
      localProduct.mlCategoryId || 'MLA3530'
    );
    if (!priceValidation.valid) {
      if (timeoutId) clearTimeout(timeoutId);
      return NextResponse.json(
        {
          error: 'El precio del producto no cumple los requisitos de Mercado Libre',
          details: priceValidation.errors,
        },
        { status: 400 }
      );
    }

    // Validar imágenes
    const images = localProduct.images
      ? Array.isArray(localProduct.images)
        ? localProduct.images
        : [localProduct.image]
      : [localProduct.image].filter(Boolean);

    try {
      const imageValidation = await validateImageAccessibility(images);
      if (!imageValidation.valid) {
        if (timeoutId) clearTimeout(timeoutId);
        return NextResponse.json(
          {
            error: 'Hay problemas con las imágenes del producto',
            details: imageValidation.errors,
          },
          { status: 400 }
        );
      }
    } catch (imageError) {
      logger.warn('Error en validación de imágenes (continuando)', {
        productId: productIdNum,
        error: imageError instanceof Error ? imageError.message : String(imageError),
      });
    }

    // Configurar stock y variantes
    const stockPolicy = resolveStockPolicy({
      categoryId: mlProductData.category_id,
      condition: mlProductData.condition,
      listingTypeId: mlProductData.listing_type_id,
    });

    if (hasVariants) {
      mlProductData.price = parseFloat(localProduct.price);
      mlProductData.available_quantity = calculateAvailableQuantityForML(
        localProduct.stock,
        stockPolicy
      );

      mlProductData.variations = (localProduct.variants as ProductVariant[]).map(
        (variant: ProductVariant) => {
          const { combinations, warnings } = ensureVariantAttributeCombinations(
            variant,
            catalogAttributeDefinitions,
            me2Rules
          );

          if (warnings.length > 0) {
            logger.warn('[ML Sync] Advertencias de normalización en variante', {
              productId: localProduct.id,
              variantId: variant.id,
              warnings,
            });
          }

          if (combinations.length === 0) {
            throw new MercadoLibreError(
              MercadoLibreErrorCode.VALIDATION_ERROR,
              `La variante ${variant.id ?? 'sin ID'} no tiene combinaciones de atributos oficiales requeridas por Mercado Libre`
            );
          }

          return {
            price: variant.price ? parseFloat(variant.price) : parseFloat(localProduct.price),
            available_quantity: calculateAvailableQuantityForML(variant.stock, stockPolicy),
            attribute_combinations: combinations.map((combo: NormalizedAttributeCombination) => ({
              id: combo.id,
              value_name: combo.value_name,
              ...(combo.value_id ? { value_id: combo.value_id } : {}),
            })),
            picture_ids: Array.isArray(variant.images) ? variant.images : [],
            seller_custom_field: variant.id?.toString() ?? '',
          };
        }
      );
    } else {
      mlProductData.price = parseFloat(localProduct.price);
      mlProductData.available_quantity = calculateAvailableQuantityForML(
        localProduct.stock,
        stockPolicy
      );
    }

    // Configurar envío para productos nuevos
    if (!localProduct.mlItemId) {
      const businessShippingConfig = await getBusinessShippingConfig();
      type MutableShippingAttributes = {
        [key: string]: unknown;
        free_shipping?: unknown;
        free_methods?: unknown;
        local_pick_up?: unknown;
        mode?: unknown;
        default_shipping_method?: unknown;
        tags?: unknown;
        dimensions?: unknown;
      };

      const shippingPayload: MutableShippingAttributes = productShippingAttributes
        ? { ...productShippingAttributes }
        : {};

      // Normalizar modo y retiro local
      if (shippingPayload.mode === undefined) {
        shippingPayload.mode = 'me2';
      }
      if (typeof shippingPayload.local_pick_up !== 'boolean') {
        shippingPayload.local_pick_up = false;
      }

      const freeShippingThreshold = businessShippingConfig?.freeShippingThreshold;
      const meetsFreeShippingThreshold =
        typeof freeShippingThreshold === 'number' &&
        freeShippingThreshold > 0 &&
        mlProductData.price >= freeShippingThreshold;

      const normalizedFreeShipping =
        typeof shippingPayload.free_shipping === 'boolean'
          ? shippingPayload.free_shipping
          : meetsFreeShippingThreshold;
      shippingPayload.free_shipping = normalizedFreeShipping;

      if (shippingPayload.free_shipping) {
        const currentFreeMethods =
          Array.isArray(shippingPayload.free_methods) && shippingPayload.free_methods.length > 0
            ? (shippingPayload.free_methods as Array<Record<string, unknown>>)
            : null;

        if (!currentFreeMethods) {
          const defaultShippingMethod = shippingPayload.default_shipping_method;
          if (
            typeof defaultShippingMethod === 'number' ||
            (typeof defaultShippingMethod === 'string' && defaultShippingMethod.trim().length > 0)
          ) {
            shippingPayload.free_methods = [{ id: defaultShippingMethod }];
          }
        }
      } else {
        delete shippingPayload.free_methods;
      }

      const height = Math.ceil(Number(localProduct.height) || 0);
      const width = Math.ceil(Number(localProduct.width) || 0);
      const length = Math.ceil(Number(localProduct.length) || 0);
      const weight = Math.ceil(Number(localProduct.weight) || 0);

      if (
        typeof shippingPayload.dimensions !== 'string' ||
        shippingPayload.dimensions.trim().length === 0
      ) {
        shippingPayload.dimensions = `${height}x${width}x${length},${weight}`;
      }

      mlProductData.shipping = shippingPayload;
    }

    // Validar y sincronizar con ML
    const mlEndpoint = localProduct.mlItemId ? `/items/${localProduct.mlItemId}` : '/items';
    // ...
    const mlMethod = localProduct.mlItemId ? 'PUT' : 'POST';

    let response: Response;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        response = await makeAuthenticatedRequest(parseInt(session.user.id), mlEndpoint, {
          method: mlMethod,
          body: JSON.stringify(mlProductData),
          signal: abortController.signal,
        });
        break;
      } catch (fetchError) {
        retryCount++;
        if (retryCount > maxRetries || abortController.signal.aborted) {
          throw new MercadoLibreError(
            MercadoLibreErrorCode.CONNECTION_ERROR,
            'Error de conexión con Mercado Libre',
            { originalError: fetchError }
          );
        }
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }

    if (!response!.ok) {
      const errorData = await response!.text();
      let errorMessage = `Error de Mercado Libre: ${errorData}`;
      let parsedDetails: {
        missingRequired?: string[];
        missingConditional?: string[];
        invalidAttributes?: string[];
      } = {};

      try {
        const parsedError = JSON.parse(errorData);
        const translation = translateMercadoLibreAttributeErrors(parsedError);
        parsedDetails = translation.details;
        if (translation.messages.length > 0) {
          errorMessage = translation.messages.join(' ');
        }
      } catch (parseError) {
        console.error('Error parseando respuesta de ML:', parseError);
      }

      throw new MercadoLibreError(MercadoLibreErrorCode.VALIDATION_ERROR, errorMessage, {
        status: response!.status,
        errorData,
        ...parsedDetails,
      });
    }

    const responseData = await response!.json();

    // Actualizar producto con datos de ML
    await db
      .update(products)
      .set({
        mlItemId: responseData.id,
        mlSyncStatus: 'synced',
        mlLastSync: new Date(),
        mlPermalink: responseData.permalink,
        mlThumbnail: responseData.thumbnail_id,
        me2Compatible: mlValidation.isReadyForSync,
        updated_at: new Date(),
      })
      .where(eq(products.id, productIdNum!));

    // Actualizar registro de sincronización
    await db
      .update(mercadolibreProductsSync)
      .set({
        syncStatus: 'synced',
        mlItemId: responseData.id,
        lastSyncAt: new Date(),
        syncError: null,
        mlData: responseData,
      })
      .where(eq(mercadolibreProductsSync.productId, productIdNum!));

    if (timeoutId) clearTimeout(timeoutId);

    logger.info('Producto sincronizado exitosamente con Mercado Libre', {
      productId: productIdNum,
      mlItemId: responseData.id,
      permalink: responseData.permalink,
    });

    return NextResponse.json({
      success: true,
      message: localProduct.mlItemId
        ? 'Producto actualizado en Mercado Libre'
        : 'Producto creado en Mercado Libre',
      data: {
        id: responseData.id,
        permalink: responseData.permalink,
        status: responseData.status,
      },
    });
  } catch (error) {
    // Actualizar estado a error
    if (productId && productIdNum) {
      try {
        await db
          .update(mercadolibreProductsSync)
          .set({
            syncStatus: 'error',
            syncError: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          })
          .where(eq(mercadolibreProductsSync.productId, productIdNum));

        await db
          .update(products)
          .set({
            mlSyncStatus: 'error',
            updated_at: new Date(),
          })
          .where(eq(products.id, productIdNum));

        logger.info('Estado de sincronización actualizado a error', { productId: productIdNum });
      } catch (updateError) {
        logger.error('Error actualizando estado de sincronización', {
          updateError: updateError instanceof Error ? updateError.message : String(updateError),
          productId: productIdNum,
        });
      }
    }

    if (error instanceof MercadoLibreError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          productId: productIdNum,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        productId: productIdNum,
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      },
      { status: 500 }
    );
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');

    if (productId) {
      const syncRecord = await db.query.mercadolibreProductsSync.findFirst({
        where: eq(mercadolibreProductsSync.productId, parseInt(productId)),
        with: {
          product: true,
        },
      });

      if (!syncRecord) {
        return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
      }

      return NextResponse.json(syncRecord);
    } else {
      const syncRecords = await db.query.mercadolibreProductsSync.findMany({
        with: {
          product: true,
        },
      });

      return NextResponse.json(syncRecords);
    }
  } catch (error) {
    logger.error('Error obteniendo estado de sincronización', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

function ensureVariantAttributeCombinations(
  variant: ProductVariant,
  catalogAttributes: MLAttributeDefinition[],
  me2Rules: ME2CategoryRules
): { combinations: NormalizedAttributeCombination[]; warnings: string[] } {
  const storedCombinations = Array.isArray(variant.mlAttributeCombinations)
    ? (variant.mlAttributeCombinations as NormalizedAttributeCombination[])
    : [];

  const variantWarnings = Array.isArray(
    (variant as { normalizationWarnings?: unknown }).normalizationWarnings
  )
    ? ((variant as { normalizationWarnings?: string[] }).normalizationWarnings ?? [])
    : [];

  if (storedCombinations.length > 0) {
    return { combinations: storedCombinations, warnings: variantWarnings };
  }

  const normalized = normalizeVariantAttributeCombinations(
    (variant.additionalAttributes as Record<string, string> | null) ?? null,
    catalogAttributes,
    me2Rules
  );

  return {
    combinations: normalized.combinations,
    warnings: normalized.warnings,
  };
}

// Función auxiliar para mapear atributos de producto a formato ML
function mapProductAttributesToML(
  productAttributes: unknown,
  catalogAttributes: MLAttributeDefinition[]
): unknown[] {
  const mapped: unknown[] = [];

  if (!productAttributes || typeof productAttributes !== 'object') {
    return mapped;
  }

  // Si es un array de atributos con formato {id, name, values}
  if (Array.isArray(productAttributes)) {
    productAttributes.forEach((attr: { id?: string; name?: string; values?: string[] }) => {
      if (attr && attr.id && attr.values && attr.values.length > 0 && attr.name) {
        // Buscar el atributo en el catálogo para validar
        const catalogAttr = (
          catalogAttributes as Array<{
            id: string;
            name: string;
            value_type?: string;
          }>
        ).find(
          (catalogItem: { id: string; name: string }) =>
            catalogItem.id === attr.id ||
            (attr.name &&
              catalogItem.name &&
              catalogItem.name.toLowerCase() === attr.name.toLowerCase())
        );

        if (catalogAttr) {
          // Para atributos de tipo lista, usar value_id si el valor parece un ID numérico
          const attributeValue = attr.values[0];
          const isListType = catalogAttr.value_type === 'list';
          const isNumericId = /^\d+$/.test(attributeValue);

          mapped.push({
            id: catalogAttr.id, // Usar el ID del catálogo
            ...(isListType && isNumericId
              ? { value_id: attributeValue }
              : { value_name: attributeValue }),
          });
        } else {
          // No agregar atributos personalizados - ML no los permite
          console.warn(`[ML-Sync] Atributo no encontrado en catálogo, omitiendo:`, attr.name);
        }
      }
    });
    return mapped;
  }

  const attrs = productAttributes as Record<string, unknown>;

  // Mapear atributos conocidos (formato antiguo)
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined && value !== '') {
      // Buscar el atributo en el catálogo para obtener el ID correcto
      const catalogAttr = (
        catalogAttributes as Array<{
          id: string;
          name: string;
        }>
      ).find((attr: { id: string; name: string }) => attr.name === key || attr.id === key);

      if (catalogAttr) {
        mapped.push({
          id: catalogAttr.id,
          value_name: String(value),
        });
      } else {
        // Si no está en el catálogo, NO agregar como atributo personalizado
        console.warn(`[ML-Sync] Atributo no encontrado en catálogo, omitiendo:`, key);
      }
    }
  }

  return mapped;
}

type MercadoLibreApiError = {
  message?: string;
  error?: string;
  status?: number;
  cause?: Array<{
    code?: string;
    message?: string;
  }>;
};

function translateMercadoLibreAttributeErrors(mlError: unknown): {
  messages: string[];
  details: {
    missingRequired?: string[];
    missingConditional?: string[];
    invalidAttributes?: string[];
  };
} {
  const parsed = (mlError || {}) as MercadoLibreApiError;
  const messages: string[] = [];
  const missingRequired = new Set<string>();
  const missingConditional = new Set<string>();
  const invalidAttributes = new Set<string>();

  const extractAttributes = (text?: string) =>
    text
      ?.match(/\[([^\]]+)\]/g)
      ?.map((match) => match.replace(/\[|\]/g, ''))
      .filter(Boolean) ?? [];

  (parsed.cause ?? []).forEach((cause) => {
    const attrs = extractAttributes(cause.message);
    switch (cause.code) {
      case 'item.attribute.missing_required':
      case 'item.attributes.missing_required':
        attrs.forEach((attr) => missingRequired.add(attr));
        if (attrs.length > 0) {
          messages.push(
            `Faltan atributos obligatorios: ${attrs.join(
              ', '
            )}. Completa cada valor antes de volver a sincronizar.`
          );
        }
        break;
      case 'item.attribute.missing_conditional_required':
      case 'item.attributes.missing_conditional_required':
        attrs.forEach((attr) => missingConditional.add(attr));
        if (attrs.length > 0) {
          messages.push(
            `Faltan atributos condicionales: ${attrs.join(
              ', '
            )}. Completa los valores o marca “No aplica” con EMPTY_*_REASON.`
          );
        }
        break;
      case 'item.attribute.invalid':
      case 'item.attributes.invalid':
        attrs.forEach((attr) => invalidAttributes.add(attr));
        if (attrs.length > 0) {
          messages.push(
            `Hay atributos con valores inválidos: ${attrs.join(
              ', '
            )}. Revisa que coincidan con las opciones oficiales.`
          );
        }
        break;
      default:
        if (cause.message) {
          messages.push(cause.message);
        }
        break;
    }
  });

  return {
    messages,
    details: {
      ...(missingRequired.size > 0 ? { missingRequired: Array.from(missingRequired) } : {}),
      ...(missingConditional.size > 0
        ? { missingConditional: Array.from(missingConditional) }
        : {}),
      ...(invalidAttributes.size > 0 ? { invalidAttributes: Array.from(invalidAttributes) } : {}),
    },
  };
}
