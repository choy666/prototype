import { NextResponse } from 'next/server';
import { db, checkDatabaseConnection } from '@/lib/db';
import { products, mercadolibreProductsSync, productVariants } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { makeAuthenticatedRequest, isConnected } from '@/lib/auth/mercadolibre';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';
import { logger } from '@/lib/utils/logger';
import { auth } from '@/lib/actions/auth';
import { sanitizeTitle, validatePrice, validateImageAccessibility } from '@/lib/validations/mercadolibre';
import { validateMLCategory, createMLCategoryErrorResponse } from '@/lib/validations/ml-category';
import type { ProductVariant } from '@/lib/schema';
import { resolveStockPolicy, calculateAvailableQuantityForML } from '@/lib/domain/ml-stock';

type DynamicAttributeForML = {
  id?: string;
  name?: string;
  value_name?: string;
  value?: string;
  values?: unknown;
};

function mapProductAttributesToMercadoLibreAttributes(rawAttributes: unknown): Array<{ id?: string; name: string; value_name: string }> {
  if (!Array.isArray(rawAttributes)) return [];

  const mapped = (rawAttributes as DynamicAttributeForML[])
    .map((attr) => {
      if (!attr) return null;

      const name = typeof attr.name === 'string' ? attr.name.trim() : undefined;
      let valueName: string | undefined;

      if (typeof attr.value_name === 'string') {
        valueName = attr.value_name.trim();
      } else if (typeof attr.value === 'string') {
        valueName = attr.value.trim();
      } else if (Array.isArray(attr.values) && typeof (attr.values as unknown[])[0] === 'string') {
        valueName = ((attr.values as unknown[])[0] as string).trim();
      }

      if (!name || !valueName) {
        return null;
      }

      let id = attr.id;
      const normalizedName = name.toLowerCase();
      if (!id) {
        if (normalizedName === 'marca' || normalizedName === 'brand') {
          id = 'BRAND';
        } else if (normalizedName === 'modelo' || normalizedName === 'model') {
          id = 'MODEL';
        }
      }

      return {
        id,
        name,
        value_name: valueName,
      };
    })
    .filter(Boolean) as Array<{ id?: string; name: string; value_name: string }>;

  return mapped;
}

export async function POST(req: Request) {
  let productId: number | null = null;
  let productIdNum: number | null = null;
  let abortController: AbortController | null = null;
  let timeoutId: NodeJS.Timeout | null = null;
  
  try {
    // Verificar conexión a base de datos primero
    try {
      const dbCheck = await checkDatabaseConnection();
      if (!dbCheck.success) {
        console.error('ERROR CRUDO CONEXIÓN DB:', dbCheck);
        return NextResponse.json({ 
          error: 'Error de conexión a base de datos' 
        }, { status: 500 });
      }
    } catch (dbConnError) {
      console.error('ERROR CRUDO VERIFICACIÓN DB:', dbConnError);
      console.error('STACK VERIFICACIÓN DB:', dbConnError instanceof Error ? dbConnError.stack : 'No stack');
      throw dbConnError;
    }
    
    // Validaciones tempranas antes de crear timeout
    let session;
    try {
      session = await auth();
    } catch (authError) {
      console.error('ERROR CRUDO AUTH:', authError);
      console.error('STACK AUTH:', authError instanceof Error ? authError.stack : 'No stack');
      throw authError;
    }
    
    if (!session?.user?.id) {
      console.error('ERROR CRUDO: Sesión inválida', { session });
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const requestData = await req.json();
    productId = requestData.productId;
    
    if (!productId) {
      return NextResponse.json({ error: 'productId es requerido' }, { status: 400 });
    }

    productIdNum = typeof productId === 'string' ? parseInt(productId) : productId;

    // Crear timeout después de validaciones básicas
    abortController = new AbortController();
    timeoutId = setTimeout(() => abortController!.abort(), 30000); // 30 segundos timeout

    // Verificar conexión con Mercado Libre
    try {
      const connected = await isConnected(parseInt(session.user.id));
      if (!connected) {
        if (timeoutId) clearTimeout(timeoutId);
        return NextResponse.json({ 
          error: 'Usuario no conectado a Mercado Libre' 
        }, { status: 400 });
      }
    } catch (connectionError) {
      console.error('ERROR CRUDO CONEXIÓN ML:', connectionError);
      console.error('STACK CONEXIÓN:', connectionError instanceof Error ? connectionError.stack : 'No stack');
      throw connectionError;
    }

    // Obtener producto local con variantes
    let localProduct;
    try {
      localProduct = await db.query.products.findFirst({
        where: eq(products.id, productIdNum!),
        with: {
          variants: {
            where: eq(productVariants.isActive, true),
          },
        },
      });
    } catch (dbError) {
      console.error('ERROR CRUDO DB QUERY PRODUCTO:', dbError);
      console.error('STACK DB QUERY:', dbError instanceof Error ? dbError.stack : 'No stack');
      throw dbError;
    }

    if (!localProduct) {
      if (timeoutId) clearTimeout(timeoutId);
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // Verificar y crear registro de sincronización (sin transacciones)
    let syncRecord: typeof mercadolibreProductsSync.$inferSelect[];
    try {
      // Check si ya existe sincronización en curso
      const existingSync = await db.query.mercadolibreProductsSync.findFirst({
        where: and(
          eq(mercadolibreProductsSync.productId, productIdNum!),
          eq(mercadolibreProductsSync.syncStatus, 'syncing')
        ),
      });

      if (existingSync) {
        throw new Error('PRODUCT_ALREADY_SYNCING');
      }

      // Crear o actualizar registro de sincronización
      syncRecord = await db.insert(mercadolibreProductsSync).values({
        productId: productIdNum!,
        syncStatus: 'syncing',
        lastSyncAt: new Date(),
        syncAttempts: 1,
      }).onConflictDoUpdate({
        target: mercadolibreProductsSync.productId,
        set: {
          syncStatus: 'syncing',
          lastSyncAt: new Date(),
          syncAttempts: sql`${mercadolibreProductsSync.syncAttempts} + 1`,
        },
      }).returning();
    } catch (txError) {
      console.error('ERROR CRUDO TRANSACCIÓN SYNC:', txError);
      console.error('STACK TRANSACCIÓN:', txError instanceof Error ? txError.stack : 'No stack');
      
      if (txError instanceof Error && txError.message === 'PRODUCT_ALREADY_SYNCING') {
        if (timeoutId) clearTimeout(timeoutId);
        return NextResponse.json({ 
          error: 'El producto ya está siendo sincronizado' 
        }, { status: 409 });
      }
      throw txError; // Re-lanzar otros errores
    }

    if (!syncRecord || syncRecord.length === 0) {
      if (timeoutId) clearTimeout(timeoutId);
      logger.error('No se pudo crear/actualizar registro de sincronización', { productId: productIdNum });
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }

    // Validar datos antes de sincronizar
    const hasVariants = localProduct.variants && Array.isArray(localProduct.variants) && (localProduct.variants as ProductVariant[]).length > 0;
    
    // Validar que la categoría ML sea una categoría hoja válida
    if (localProduct.mlCategoryId) {
      try {
        const isValidCategory = await validateMLCategory(localProduct.mlCategoryId);
        
        if (!isValidCategory) {
          if (timeoutId) clearTimeout(timeoutId);
          logger.error('Producto intenta sincronizar con categoría ML no válida', {
            productId: productIdNum,
            mlCategoryId: localProduct.mlCategoryId,
          });
          return NextResponse.json({
            ...createMLCategoryErrorResponse(localProduct.mlCategoryId),
            error: createMLCategoryErrorResponse(localProduct.mlCategoryId).error + ' Por favor, seleccione una categoría oficial y vuelva a intentar.',
          }, { status: 400 });
        }
      } catch (categoryError) {
        console.error('ERROR CRUDO VALIDACIÓN CATEGORÍA:', categoryError);
        if (timeoutId) clearTimeout(timeoutId);
        throw categoryError;
      }
    }
    
    if (hasVariants) {
      // Validar límite de 60 variantes de Mercado Libre
      if ((localProduct.variants as ProductVariant[]).length > 60) {
        if (timeoutId) clearTimeout(timeoutId);
        logger.error('Producto excede límite de variantes de ML', {
          productId: productIdNum,
          variantsCount: (localProduct.variants as ProductVariant[]).length
        });
        return NextResponse.json({
          error: 'Mercado Libre permite máximo 60 variantes por publicación',
          variantsCount: (localProduct.variants as ProductVariant[]).length,
          maxAllowed: 60
        }, { status: 400 });
      }
      
      // Validar unicidad de attribute_combinations entre variantes
      const attributeCombinations = (localProduct.variants as ProductVariant[]).map((variant: ProductVariant) => {
        if (!variant.mlAttributeCombinations || !Array.isArray(variant.mlAttributeCombinations)) {
          return null;
        }
        // Crear clave única basada en los atributos combinados
        return variant.mlAttributeCombinations
          .map((attr: { id: string; value_id: string }) => `${attr.id}:${attr.value_id}`)
          .sort() // Ordenar para asegurar consistencia
          .join('|');
      });
      
      const duplicateCombinations = attributeCombinations.filter((combo: string | null, index: number) => 
        combo && attributeCombinations.indexOf(combo) !== index
      );
      
      if (duplicateCombinations.length > 0) {
        if (timeoutId) clearTimeout(timeoutId);
        logger.error('Variantes con combinaciones de atributos duplicadas', {
          productId: productIdNum,
          duplicateCombinations: [...new Set(duplicateCombinations)]
        });
        return NextResponse.json({
          error: 'Las variantes no pueden tener combinaciones de atributos duplicadas',
          duplicateCombinations: [...new Set(duplicateCombinations)]
        }, { status: 400 });
      }
      
      const invalidVariants = (localProduct.variants as ProductVariant[]).filter((variant: ProductVariant) => 
        !variant.mlAttributeCombinations || 
        (Array.isArray(variant.mlAttributeCombinations) && variant.mlAttributeCombinations.length === 0)
      );
      
      if (invalidVariants.length > 0) {
        if (timeoutId) clearTimeout(timeoutId);
        logger.error('Variantes sin atributos ML válidos', {
          productId: productIdNum,
          invalidVariantsCount: invalidVariants.length,
          invalidVariantIds: invalidVariants.map((v: ProductVariant) => v.id)
        });
        return NextResponse.json({
          error: 'Las variantes deben tener atributos de Mercado Libre configurados',
          invalidVariants: invalidVariants.map((v: ProductVariant) => ({ id: v.id, name: v.name }))
        }, { status: 400 });
      }
    }

    // Preparar datos para Mercado Libre
    
    const mlProductData: {
      title: string;
      category_id: string;
      currency_id: string;
      buying_mode: string;
      condition: string;
      listing_type_id: string;
      description: string;
      pictures: Array<{ source: string }>;
      attributes: unknown[];
      price?: number;
      available_quantity?: number;
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
          return sanitizeTitle(localProduct.name); // Sanitizar HTML del título
        } catch (sanitizeError) {
          logger.warn('Error sanitizando título, usando original', {
            productId: productIdNum,
            error: sanitizeError instanceof Error ? sanitizeError.message : String(sanitizeError)
          });
          return localProduct.name; // Fallback al título original
        }
      })(),
      category_id: localProduct.mlCategoryId || 'MLA3530', // Categoría por defecto
      currency_id: localProduct.mlCurrencyId || 'ARS',
      buying_mode: localProduct.mlBuyingMode || 'buy_it_now',
      condition: localProduct.mlCondition || 'new',
      listing_type_id: localProduct.mlListingTypeId || 'bronze',
      description: localProduct.description || '',
      pictures: localProduct.image ? [{
        source: localProduct.image,
      }] : [],
      attributes: mapProductAttributesToMercadoLibreAttributes(localProduct.attributes as unknown),
    };

    const categoryId = mlProductData.category_id;
    const condition = mlProductData.condition;
    const listingTypeId = mlProductData.listing_type_id;

    // Validar atributos obligatorios (ej: BRAND y MODEL) para ciertas categorías
    if (categoryId === 'MLA3530') {
      const mlAttributes = (mlProductData.attributes as Array<{ id?: string; name?: string; value_name?: string }>) || [];

      const hasBrand = mlAttributes.some((attr) =>
        (attr.id === 'BRAND' || attr.name?.toUpperCase() === 'BRAND' || attr.name?.toUpperCase() === 'MARCA') &&
        !!attr.value_name
      );

      const hasModel = mlAttributes.some((attr) =>
        (attr.id === 'MODEL' || attr.name?.toUpperCase() === 'MODEL' || attr.name?.toUpperCase() === 'MODELO') &&
        !!attr.value_name
      );

      if (!hasBrand || !hasModel) {
        if (timeoutId) clearTimeout(timeoutId);
        logger.error('Faltan atributos obligatorios BRAND/MODEL para categoría MLA3530', {
          productId: productIdNum,
          categoryId,
          hasBrand,
          hasModel,
        });

        return NextResponse.json(
          {
            error: 'Faltan atributos obligatorios para Mercado Libre',
            details: [
              !hasBrand ? 'Debes indicar la marca (atributo BRAND) para esta categoría.' : null,
              !hasModel ? 'Debes indicar el modelo (atributo MODEL) para esta categoría.' : null,
            ].filter(Boolean),
          },
          { status: 400 }
        );
      }
    }

    // Determinar política de stock según categoría/condición/listing type
    const stockPolicy = resolveStockPolicy({
      categoryId,
      condition,
      listingTypeId,
    });

    // Validar precio con categoría dinámica antes de asignar
    const priceValidation = validatePrice(
      localProduct.price, 
      localProduct.mlCategoryId || 'MLA3530'
    );
    if (!priceValidation.valid) {
      if (timeoutId) clearTimeout(timeoutId);
      logger.error('Validación de precio fallida', {
        productId: productIdNum,
        errors: priceValidation.errors,
        price: localProduct.price,
        categoryId: localProduct.mlCategoryId
      });
      return NextResponse.json({
        error: 'Validación de precio fallida',
        details: priceValidation.errors
      }, { status: 400 });
    }

    // Validar imágenes con accesibilidad (no bloqueante)
    const images = localProduct.images ? 
      (Array.isArray(localProduct.images) ? localProduct.images : [localProduct.image]) : 
      [localProduct.image].filter(Boolean);
    
    let imageWarnings: string[] = [];
    try {
      const imageValidation = await validateImageAccessibility(images);
      if (!imageValidation.valid) {
        if (timeoutId) clearTimeout(timeoutId);
        logger.error('Validación de imágenes fallida', {
          productId: productIdNum,
          errors: imageValidation.errors
        });
        return NextResponse.json({
          error: 'Validación de imágenes fallida',
          details: imageValidation.errors
        }, { status: 400 });
      }
      imageWarnings = imageValidation.warnings;
    } catch (imageError) {
      logger.warn('Error en validación de accesibilidad de imágenes (continuando)', {
        productId: productIdNum,
        error: imageError instanceof Error ? imageError.message : String(imageError)
      });
      // Continuar con la sincronización incluso si falla la verificación de accesibilidad
    }

    if (hasVariants) {
      // Producto con variantes: usar precio base del producto padre y variaciones
      mlProductData.price = parseFloat(localProduct.price);
      mlProductData.available_quantity = calculateAvailableQuantityForML(localProduct.stock, stockPolicy);
      
      // Agregar variaciones
      mlProductData.variations = (localProduct.variants as ProductVariant[]).map((variant: ProductVariant) => ({
        price: variant.price ? parseFloat(variant.price) : parseFloat(localProduct.price),
        available_quantity: calculateAvailableQuantityForML(variant.stock, stockPolicy),
        attribute_combinations: (variant.mlAttributeCombinations as unknown[]) || [],
        picture_ids: (variant.images as unknown[]) || [],
        seller_custom_field: variant.id.toString(), // Referencia local
      }));
      
      logger.info('Producto con variantes preparado para ML', {
        productId: productIdNum,
        variantsCount: (localProduct.variants as ProductVariant[]).length,
        hasVariations: true,
        stockPolicy,
      });
    } else {
      // Producto simple sin variantes
      mlProductData.price = parseFloat(localProduct.price);
      mlProductData.available_quantity = calculateAvailableQuantityForML(localProduct.stock, stockPolicy);
      
      logger.info('Producto simple preparado para ML', {
        productId: productIdNum,
        hasVariations: false,
        stockPolicy,
      });
    }

    // Determinar si es CREATE o UPDATE
    const isUpdate = !!localProduct.mlItemId;
    const mlEndpoint = isUpdate ? `/items/${localProduct.mlItemId}` : '/items';
    const mlMethod = isUpdate ? 'PUT' : 'POST';
    
    logger.info(isUpdate ? 'Actualizando producto existente en ML' : 'Creando nuevo producto en ML', {
      productId: productIdNum,
      mlItemId: localProduct.mlItemId,
      method: mlMethod,
      endpoint: mlEndpoint
    });

    // Enviar a Mercado Libre con timeout y retry logic
    let response: Response;
    let retryCount = 0;
    const maxRetries = 2;
    
    if (!abortController) {
      throw new Error('AbortController no inicializado');
    }
    
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
        break; // Si tiene éxito, salir del loop
      } catch (fetchError) {
        retryCount++;
        if (retryCount > maxRetries || abortController.signal.aborted) {
          if (timeoutId) clearTimeout(timeoutId);
          logger.error('Error de red con Mercado Libre después de reintentos', { 
            error: fetchError instanceof Error ? fetchError.message : String(fetchError),
            retryCount,
            productId: productIdNum
          });
          throw new MercadoLibreError(
            MercadoLibreErrorCode.CONNECTION_ERROR,
            'Error de conexión con Mercado Libre',
            { originalError: fetchError }
          );
        }
        // Esperar exponential backoff antes de reintentar
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }

    if (!response!.ok) {
      let errorData: string;
      let parsedError: {
        cause?: string;
        message?: string;
        [key: string]: unknown;
      } | null = null;
      try {
        errorData = await response!.text();
        // Intentar parsear error específico de ML
        try {
          parsedError = JSON.parse(errorData);
        } catch {
          // No es JSON, usar texto plano
        }
      } catch {
        errorData = 'Error desconocido al leer respuesta de ML';
      }
      
      if (timeoutId) clearTimeout(timeoutId);
      
      // Manejo específico de errores de ML para validaciones conocidas
      let errorMessage = `Error creando producto en ML: ${errorData}`;
      if (parsedError?.cause === 'attribute_combinations_not_allowed' || 
          parsedError?.cause === 'invalid_attribute_combinations' ||
          parsedError?.cause === 'duplicate_attribute_combinations') {
        errorMessage = `Error en atributos de variantes: ${parsedError.message || errorData}`;
        logger.error('Error específico de ML en atributos de variantes', { 
          cause: parsedError.cause,
          error: parsedError.message || errorData,
          productId: productIdNum 
        });
      } else if (parsedError?.cause && Array.isArray(parsedError.cause)) {
        const causes = parsedError.cause as Array<{ code?: string; message?: string; [key: string]: unknown }>;

        // Buscar errores de cantidad máxima (available_quantity)
        const quantityError = causes.find((cause) =>
          cause.code === 'item.available_quantity.invalid' &&
          typeof cause.message === 'string' &&
          cause.message.includes('max. value is 1')
        );

        if (quantityError) {
          errorMessage =
            'Mercado Libre solo permite publicar cantidad 1 para esta combinación de categoría, condición y tipo de publicación. ' +
            'Ajusta el stock de la publicación a 1 o modifica la condición o el tipo de publicación del producto.';
          logger.error('Error de cantidad máxima de Mercado Libre', {
            categoryId: mlProductData.category_id,
            condition: mlProductData.condition,
            listingTypeId: mlProductData.listing_type_id,
            message: quantityError.message,
            productId: productIdNum,
          });
        }

        // Buscar errores de categoría inválida (no hoja o no permitida)
        const categoryError = causes.find((cause) =>
          cause.code === 'item.category_id.invalid'
        );

        if (categoryError) {
          errorMessage =
            'La categoría de Mercado Libre seleccionada no permite publicar directamente. ' +
            'Debes seleccionar una categoría más específica (categoría hoja) en el campo "Categoría Mercado Libre" del producto.';

          logger.error('Error de categoría inválida de Mercado Libre', {
            categoryId: mlProductData.category_id,
            message: categoryError.message,
            productId: productIdNum,
          });
        }

        // Buscar errores de atributos requeridos (por ejemplo BRAND/MODEL)
        const missingAttrsError = causes.find((cause) =>
          cause.code === 'item.attributes.missing_required'
        );

        if (missingAttrsError) {
          errorMessage =
            'Faltan atributos obligatorios para Mercado Libre (por ejemplo, Marca y Modelo). ' +
            'Completa los atributos requeridos en la ficha del producto antes de sincronizar.';
          logger.error('Error de atributos requeridos de Mercado Libre', {
            categoryId: mlProductData.category_id,
            message: missingAttrsError.message,
            productId: productIdNum,
          });
        }

        // Buscar errores de precio mínimo
        const priceError = causes.find((cause: { code?: string; message?: string }) => 
          cause.code === 'item.price.invalid' && cause.message?.includes('minimum of price')
        );
        
        if (priceError) {
          const minimumPrice = priceError.message?.match(/minimum of price (\d+)/)?.[1];
          const currentPrice = hasVariants 
            ? (localProduct.variants as ProductVariant[])[0]?.price || localProduct.price
            : localProduct.price;
          
          errorMessage = `Precio mínimo requerido: La categoría ${localProduct.mlCategoryId || 'MLA3530'} requiere un precio mínimo de $${minimumPrice || '1000'}. Precio actual: $${currentPrice}.`;
          logger.error('Error de precio mínimo de Mercado Libre', { 
            categoryId: localProduct.mlCategoryId,
            minimumPrice: minimumPrice || '1000',
            currentPrice,
            productId: productIdNum 
          });
        }
      }
      
      logger.error('Error en respuesta de Mercado Libre', { 
        status: response!.status, 
        errorData, 
        parsedError,
        productId: productIdNum 
      });
      
      throw new MercadoLibreError(
        MercadoLibreErrorCode.INVALID_REQUEST,
        errorMessage,
        { status: response!.status, error: errorData, parsedError }
      );
    }

    interface MercadoLibreItemResponse {
      id: string;
      permalink?: string;
      thumbnail?: string;
      [key: string]: unknown;
    }
    
    let mlItem: MercadoLibreItemResponse;
    try {
      mlItem = await response!.json();
    } catch (parseError) {
      if (timeoutId) clearTimeout(timeoutId);
      logger.error('Error parseando respuesta JSON de Mercado Libre', { 
        error: parseError instanceof Error ? parseError.message : String(parseError),
        productId: productIdNum 
      });
      throw new MercadoLibreError(
        MercadoLibreErrorCode.INVALID_REQUEST,
        'Respuesta inválida de Mercado Libre',
        { originalError: parseError }
      );
    }
    
    const mlItemId = mlItem?.id;
    if (!mlItemId) {
      if (timeoutId) clearTimeout(timeoutId);
      logger.error('Respuesta de ML no contiene ID válido', { mlItem, productId: productIdNum });
      throw new MercadoLibreError(
        MercadoLibreErrorCode.INVALID_REQUEST,
        'La respuesta de Mercado Libre no contiene un ID válido',
        { mlItem }
      );
    }

    // Actualizar producto local con ID de ML (operaciones individuales)
    try {
      // Actualizar producto padre
      await db.update(products)
        .set({
          mlItemId,
          mlSyncStatus: 'synced',
          mlLastSync: new Date(),
          mlPermalink: mlItem.permalink || null,
          mlThumbnail: mlItem.thumbnail || null,
          updated_at: new Date(),
        })
        .where(eq(products.id, productIdNum!));

      // Actualizar IDs de variación si el producto tiene variantes
      if (hasVariants && mlItem.variations && Array.isArray(mlItem.variations)) {
        for (const mlVariation of mlItem.variations) {
          // Mapear usando seller_custom_field que guardamos como referencia
          const localVariantId = parseInt(mlVariation.seller_custom_field);
          if (!isNaN(localVariantId)) {
            await db.update(productVariants)
              .set({
                mlVariationId: mlVariation.id.toString(),
                mlSyncStatus: 'synced',
                updated_at: new Date(),
              })
              .where(eq(productVariants.id, localVariantId));
            
            logger.info('Variante actualizada con ID de ML', {
              localVariantId,
              mlVariationId: mlVariation.id,
              productId: productIdNum
            });
          }
        }
      }
    } catch (dbError) {
      if (timeoutId) clearTimeout(timeoutId);
      logger.error('Error actualizando producto local con datos de ML', { 
        error: dbError instanceof Error ? dbError.message : String(dbError),
        productId: productIdNum,
        mlItemId 
      });
      throw new MercadoLibreError(
        MercadoLibreErrorCode.INTERNAL_SERVER_ERROR,
        'Error actualizando base de datos local',
        { originalError: dbError }
      );
    }

    // Actualizar registro de sincronización
    try {
      await db.update(mercadolibreProductsSync)
        .set({
          mlItemId,
          syncStatus: 'synced',
          lastSyncAt: new Date(),
          mlData: mlItem,
          updatedAt: new Date(),
        })
        .where(eq(mercadolibreProductsSync.id, syncRecord[0].id));
    } catch (dbError) {
      if (timeoutId) clearTimeout(timeoutId);
      logger.error('Error actualizando registro de sincronización', { 
        error: dbError instanceof Error ? dbError.message : String(dbError),
        productId: productIdNum,
        syncRecordId: syncRecord[0]?.id 
      });
      throw new MercadoLibreError(
        MercadoLibreErrorCode.INTERNAL_SERVER_ERROR,
        'Error actualizando registro de sincronización',
        { originalError: dbError }
      );
    }

    if (timeoutId) clearTimeout(timeoutId);
    logger.info('Producto sincronizado exitosamente', {
      productId: productIdNum!,
      mlItemId,
      userId: session.user.id,
      mlPermalink: mlItem.permalink,
    });

    return NextResponse.json({
      success: true,
      productId: productIdNum!,
      mlItemId,
      mlPermalink: mlItem.permalink,
      syncStatus: 'synced',
      warnings: imageWarnings.length > 0 ? imageWarnings : undefined,
    });

  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    
    // LOGGING CRUDO ANTES DEL LOGGER - CAPTURA EL ERROR REAL
    console.error('=== ERROR CRUDO SINCRONIZACIÓN PRODUCTO ===');
    console.error('ERROR:', error);
    console.error('TIPO:', error?.constructor?.name);
    console.error('MENSAJE:', error instanceof Error ? error.message : String(error));
    console.error('STACK:', error instanceof Error ? error.stack : 'No stack disponible');
    console.error('PRODUCT ID:', productIdNum);
    console.error('=== FIN ERROR CRUDO ===');
    
    const errorContext = {
      productId: productIdNum,
      userId: 'unknown', // No podemos depender de session aquí
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name || 'Unknown',
    };
    
    logger.error('Error sincronizando producto - Contexto completo', errorContext);

    // Actualizar estado de sincronización a error (sin afectar el error original)
    if (productId && productIdNum) {
      try {
        // Primero actualizar el registro de sincronización
        await db.update(mercadolibreProductsSync)
          .set({
            syncStatus: 'error',
            syncError: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          })
          .where(eq(mercadolibreProductsSync.productId, productIdNum!));

        // Luego actualizar el producto
        await db.update(products)
          .set({
            mlSyncStatus: 'error',
            updated_at: new Date(),
          })
          .where(eq(products.id, productIdNum!));
          
        logger.info('Estado de sincronización actualizado a error', { productId: productIdNum });
      } catch (updateError) {
        logger.error('Error actualizando estado de sincronización (no crítico)', { 
          updateError: updateError instanceof Error ? updateError.message : String(updateError),
          productId: productIdNum 
        });
        // No relanzar este error para no ocultar el error original
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

    // Error genérico con más contexto para debugging
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
    // Garantizar que el timeout siempre se limpie
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
      // Obtener estado de sincronización de un producto específico
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
      // Obtener todos los registros de sincronización del usuario
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
