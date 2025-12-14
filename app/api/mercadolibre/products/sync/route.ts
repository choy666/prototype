import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { 
  products, 
  mercadolibreProductsSync,
  categories,
  ProductVariant
} from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { logger } from '@/lib/utils/logger';
import { 
  makeAuthenticatedRequest
} from '@/lib/auth/mercadolibre';
import { 
  getAvailableListingTypes 
} from '@/lib/actions/mercadolibre-listing-types';
import { 
  validatePrice, 
  validateImageAccessibility,
  sanitizeTitle
} from '@/lib/validations/mercadolibre';
import { 
  validateProductForMLSync
} from '@/lib/validations/ml-sync-validation';
import { 
  resolveStockPolicy, 
  calculateAvailableQuantityForML
} from '@/lib/domain/ml-stock';

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
    timeoutId = setTimeout(() => {
      abortController?.abort();
    }, 5 * 60 * 1000);

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
        await db.update(mercadolibreProductsSync)
          .set({ 
            syncStatus: 'error',
            syncError: 'Timeout: sincronización expirada después de 5 minutos'
          })
          .where(eq(mercadolibreProductsSync.productId, productIdNum!));
      } else {
        return NextResponse.json({ error: 'El producto ya está siendo sincronizado' }, { status: 409 });
      }
    }

    // Verificar límite de intentos
    const currentRecord = await db.query.mercadolibreProductsSync.findFirst({
      where: eq(mercadolibreProductsSync.productId, productIdNum!),
    });

    if (currentRecord && currentRecord.syncAttempts >= 3) {
      await db.update(mercadolibreProductsSync)
        .set({ 
          syncStatus: 'error',
          syncError: 'Límite de intentos alcanzado (3). Por favor revise la configuración del producto.'
        })
        .where(eq(mercadolibreProductsSync.productId, productIdNum!));
      return NextResponse.json({ error: 'Límite de intentos de sincronización alcanzado' }, { status: 429 });
    }

    // Crear o actualizar registro de sincronización
    await db.insert(mercadolibreProductsSync).values({
      productId: productIdNum!,
      syncStatus: 'syncing',
      lastSyncAt: new Date(),
      syncAttempts: currentRecord ? currentRecord.syncAttempts + 1 : 1,
    }).onConflictDoUpdate({
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

    // Obtener atributos de la categoría
    const catalogAttributes = await db.query.categories.findFirst({
      where: eq(categories.mlCategoryId, localProduct.mlCategoryId || 'MLA3530'),
    });
    
    // Debug: Verificar datos de la categoría
    console.log('[ML-Sync-Debug] Categoría encontrada:', {
      categoryId: localProduct.mlCategoryId,
      catalogFound: !!catalogAttributes,
      catalogName: catalogAttributes?.name,
      catalogMlId: catalogAttributes?.mlCategoryId,
      hasAttributes: !!(catalogAttributes?.attributes as unknown[] && (catalogAttributes?.attributes as unknown[]).length > 0),
      attributeCount: (catalogAttributes?.attributes as unknown[] || []).length,
      attributes: catalogAttributes?.attributes
    });
    
    // Debug: Verificar atributos del producto
    console.log('[ML-Sync-Debug] Atributos del producto:', {
      productId: localProduct.id,
      hasAttributes: !!(localProduct.attributes as unknown[] && (localProduct.attributes as unknown[]).length > 0),
      attributeCount: (localProduct.attributes as unknown[] || []).length,
      attributes: localProduct.attributes
    });

    // Preparar atributos adicionales para variantes
    const hasVariants = localProduct.variants && localProduct.variants.length > 0;
    const additionalMLAttributes: unknown[] = [];
    
    if (hasVariants) {
      for (const variant of localProduct.variants) {
        if (variant.additionalAttributes && typeof variant.additionalAttributes === 'object') {
          const preparedMLAttributes = prepareVariantMLAttributes(
            variant.additionalAttributes as Record<string, unknown>,
            catalogAttributes?.attributes as unknown[] || []
          );
          additionalMLAttributes.push(...preparedMLAttributes);
        }
      }
    }

    // Obtener listing types óptimos
    const listingTypes = await getAvailableListingTypes(
      parseInt(session.user.id),
      localProduct.mlCategoryId || 'MLA3530'
    );
    const optimalListingType = listingTypes[0]?.id || 'bronze';

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
            error: sanitizeError instanceof Error ? sanitizeError.message : String(sanitizeError)
          });
          return localProduct.name;
        }
      })(),
      category_id: localProduct.mlCategoryId || 'MLA3530',
      currency_id: localProduct.mlCurrencyId || 'ARS',
      buying_mode: localProduct.mlBuyingMode || 'buy_it_now',
      condition: localProduct.mlCondition || 'new',
      listing_type_id: optimalListingType,
      description: localProduct.description || '',
      pictures: localProduct.image ? [{
        source: localProduct.image,
      }] : [],
      attributes: [
        ...mapProductAttributesToML(
          localProduct.attributes as unknown,
          catalogAttributes?.attributes as unknown[] || [],
        ),
        ...additionalMLAttributes
      ] as Array<Record<string, unknown>>,
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
          missingAttributes: mlValidation.missingRequired.map(attr => ({
            id: attr.id,
            name: attr.name,
            required: attr.tags?.required || false
          }))
        },
        { status: 400 }
      );
    }

    // Log de advertencias si existen
    if (mlValidation.warnings.length > 0) {
      logger.warn('Advertencias de sincronización ML', {
        productId: productIdNum,
        warnings: mlValidation.warnings
      });
    }

    // Validar precio
    const priceValidation = validatePrice(
      localProduct.price, 
      localProduct.mlCategoryId || 'MLA3530'
    );
    if (!priceValidation.valid) {
      if (timeoutId) clearTimeout(timeoutId);
      return NextResponse.json({
        error: 'El precio del producto no cumple los requisitos de Mercado Libre',
        details: priceValidation.errors,
      }, { status: 400 });
    }

    // Validar imágenes
    const images = localProduct.images ? 
      (Array.isArray(localProduct.images) ? localProduct.images : [localProduct.image]) : 
      [localProduct.image].filter(Boolean);
    
    try {
      const imageValidation = await validateImageAccessibility(images);
      if (!imageValidation.valid) {
        if (timeoutId) clearTimeout(timeoutId);
        return NextResponse.json({
          error: 'Hay problemas con las imágenes del producto',
          details: imageValidation.errors,
        }, { status: 400 });
      }
    } catch (imageError) {
      logger.warn('Error en validación de imágenes (continuando)', {
        productId: productIdNum,
        error: imageError instanceof Error ? imageError.message : String(imageError)
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
      mlProductData.available_quantity = calculateAvailableQuantityForML(localProduct.stock, stockPolicy);
      
      mlProductData.variations = (localProduct.variants as ProductVariant[]).map((variant: ProductVariant) => ({
        price: variant.price ? parseFloat(variant.price) : parseFloat(localProduct.price),
        available_quantity: calculateAvailableQuantityForML(variant.stock, stockPolicy),
        attribute_combinations: (variant.mlAttributeCombinations as unknown[]) || [],
        picture_ids: (variant.images as unknown[]) || [],
        seller_custom_field: variant.id.toString(),
      }));
    } else {
      mlProductData.price = parseFloat(localProduct.price);
      mlProductData.available_quantity = calculateAvailableQuantityForML(localProduct.stock, stockPolicy);
    }

    // Configurar envío para productos nuevos
    if (!localProduct.mlItemId) {
      const shipping: Record<string, unknown> = {
        mode: 'me2',
        local_pick_up: false,
        free_shipping: mlProductData.price >= 5000,
        free_methods: mlProductData.price >= 5000 ? [{
          id: '100009',
          rule: {
            free_mode: 'country',
            value: null
          }
        }] : [],
        dimensions: `${Math.ceil(Number(localProduct.height) || 0)}x${Math.ceil(Number(localProduct.width) || 0)}x${Math.ceil(Number(localProduct.length) || 0)},${Math.ceil(Number(localProduct.weight) || 0)}`,
        tags: mlProductData.price >= 5000 ? ['self_service_inmediate'] : undefined
      };

      mlProductData.shipping = shipping;
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
        response = await makeAuthenticatedRequest(
          parseInt(session.user.id),
          mlEndpoint,
          {
            method: mlMethod,
            body: JSON.stringify(mlProductData),
            signal: abortController.signal,
          }
        );
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
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }

    if (!response!.ok) {
      const errorData = await response!.text();
      
      // Intentar parsear el error para detectar atributos condicionalmente requeridos
      let errorMessage = `Error de Mercado Libre: ${errorData}`;
      let missingConditionalAttrs: string[] = [];
      
      try {
        const parsedError = JSON.parse(errorData);
        if (parsedError.cause && Array.isArray(parsedError.cause)) {
          const conditionalError = parsedError.cause.find((cause: {
            code?: string;
            message?: string;
          }) => 
            cause.code === 'item.attribute.missing_conditional_required'
          );
          
          if (conditionalError) {
            // Extraer atributos del mensaje usando regex
            const matches = conditionalError.message.match(/\[([A-Z_]+)\]/g);
            if (matches) {
              missingConditionalAttrs = matches.map((match: string) => 
                match.replace(/[\[\]]/g, '')
              );
              
              errorMessage = `Faltan atributos condicionalmente requeridos: ${missingConditionalAttrs.join(', ')}. ` +
                `Puedes agregar los valores o especificar una razón por la que no aplican (ej: EMPTY_GTIN_REASON).`;
            }
          }
        }
      } catch (parseError) {
        // Si no se puede parsear, usar el error original
        console.error('Error parseando respuesta de ML:', parseError);
      }
      
      throw new MercadoLibreError(
        MercadoLibreErrorCode.VALIDATION_ERROR,
        errorMessage,
        { status: response!.status, errorData, missingConditionalAttrs }
      );
    }

    const responseData = await response!.json();
    
    // Actualizar producto con datos de ML
    await db.update(products)
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
    await db.update(mercadolibreProductsSync)
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
      permalink: responseData.permalink
    });

    return NextResponse.json({
      success: true,
      message: localProduct.mlItemId ? 'Producto actualizado en Mercado Libre' : 'Producto creado en Mercado Libre',
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
        await db.update(mercadolibreProductsSync)
          .set({
            syncStatus: 'error',
            syncError: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          })
          .where(eq(mercadolibreProductsSync.productId, productIdNum));

        await db.update(products)
          .set({
            mlSyncStatus: 'error',
            updated_at: new Date(),
          })
          .where(eq(products.id, productIdNum));
          
        logger.info('Estado de sincronización actualizado a error', { productId: productIdNum });
      } catch (updateError) {
        logger.error('Error actualizando estado de sincronización', { 
          updateError: updateError instanceof Error ? updateError.message : String(updateError),
          productId: productIdNum 
        });
      }
    }

    if (error instanceof MercadoLibreError) {
      return NextResponse.json(
        { 
          error: error.message, 
          code: error.code,
          productId: productIdNum,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        productId: productIdNum,
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID()
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

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función auxiliar para preparar atributos de variantes
function prepareVariantMLAttributes(
  additionalAttributes: Record<string, unknown>,
  catalogAttributes: unknown[]
): unknown[] {
  const prepared: unknown[] = [];
  
  // Mapear atributos adicionales al formato de ML
  for (const [key, value] of Object.entries(additionalAttributes)) {
    if (value !== null && value !== undefined) {
      const catalogAttr = (catalogAttributes as Array<{
        id: string;
        name: string;
      }>).find(
        (attr: { id: string; name: string }) => attr.id === key || attr.name === key
      );
      
      if (catalogAttr) {
        prepared.push({
          id: catalogAttr.id,
          value_name: String(value),
        });
      }
    }
  }
  
  return prepared;
}

// Función auxiliar para mapear atributos de producto a formato ML
function mapProductAttributesToML(
  productAttributes: unknown,
  catalogAttributes: unknown[]
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
        const catalogAttr = (catalogAttributes as Array<{
          id: string;
          name: string;
          value_type?: string;
        }>).find(
          (catalogItem: { id: string; name: string }) => 
            catalogItem.id === attr.id || (attr.name && catalogItem.name && catalogItem.name.toLowerCase() === attr.name.toLowerCase())
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
              : { value_name: attributeValue }
            )
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
      const catalogAttr = (catalogAttributes as Array<{
        id: string;
        name: string;
      }>).find(
        (attr: { id: string; name: string }) => attr.name === key || attr.id === key
      );
      
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
