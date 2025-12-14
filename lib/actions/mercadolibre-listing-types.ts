import { makeAuthenticatedRequest, getTokens } from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';
import { MercadoLibreError, MercadoLibreErrorCode } from '@/lib/errors/mercadolibre-errors';

/**
 * Obtiene los listing_types disponibles para un usuario y categoría específica
 */
export async function getAvailableListingTypes(
  userId: number,
  categoryId: string
): Promise<Array<{ id: string; name: string; remaining_listings?: number | null }>> {
  try {
    // Obtener el mercadoLibreId del usuario
    const tokens = await getTokens(userId);
    if (!tokens?.mercadoLibreId) {
      throw new MercadoLibreError(
        MercadoLibreErrorCode.AUTH_FAILED,
        'Usuario no conectado a Mercado Libre',
        { userId }
      );
    }

    const response = await makeAuthenticatedRequest(
      userId,
      `/users/${tokens.mercadoLibreId}/available_listing_types?category_id=${categoryId}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('Error obteniendo listing types disponibles', {
        userId,
        mercadoLibreId: tokens.mercadoLibreId,
        categoryId,
        error,
        status: response.status,
      });
      throw new MercadoLibreError(
        MercadoLibreErrorCode.INVALID_REQUEST,
        'No se pudieron obtener los tipos de publicación disponibles',
        { status: response.status, error }
      );
    }

    const data = await response.json();
    return data.available || [];
  } catch (error) {
    logger.error('Error en getAvailableListingTypes', {
      userId,
      categoryId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Obtiene el listing_type_id óptimo con fallback automático
 * Prioridad: gold_pro > gold_special > free
 */
export async function getOptimalListingType(
  userId: number,
  categoryId: string,
  preferredListingType?: string
): Promise<string> {
  try {
    const availableTypes = await getAvailableListingTypes(userId, categoryId);
    
    if (availableTypes.length === 0) {
      throw new MercadoLibreError(
        MercadoLibreErrorCode.INVALID_REQUEST,
        'No hay tipos de publicación disponibles para esta categoría',
        { categoryId }
      );
    }

    // Orden de prioridad para fallback
    const priorityOrder = ['gold_pro', 'gold_special', 'free'];
    
    // Si se prefiere un tipo específico y está disponible, usarlo
    if (preferredListingType) {
      const preferred = availableTypes.find(t => t.id === preferredListingType);
      if (preferred) {
        logger.info('Usando listing_type preferido', {
          userId,
          categoryId,
          listingType: preferredListingType,
        });
        return preferred.id;
      }
    }

    // Intentar en orden de prioridad
    for (const priorityType of priorityOrder) {
      const available = availableTypes.find(t => t.id === priorityType);
      if (available) {
        // Verificar si hay publicaciones restantes para el tipo free
        if (priorityType === 'free' && available.remaining_listings !== undefined && available.remaining_listings !== null && available.remaining_listings <= 0) {
          logger.warn('No quedan publicaciones gratuitas disponibles', {
            userId,
            categoryId,
            remaining: available.remaining_listings,
          });
          continue;
        }
        
        logger.info('Seleccionado listing_type óptimo', {
          userId,
          categoryId,
          selectedType: priorityType,
          wasPreferred: false,
        });
        return priorityType;
      }
    }

    // Si no hay ninguno de los prioritarios, usar el primero disponible
    const fallbackType = availableTypes[0];
    logger.warn('Usando listing_type de fallback (no prioritario)', {
      userId,
      categoryId,
      fallbackType: fallbackType.id,
      availableTypes: availableTypes.map(t => t.id),
    });
    
    return fallbackType.id;
  } catch (error) {
    logger.error('Error obteniendo listing_type óptimo', {
      userId,
      categoryId,
      preferredListingType,
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Último recurso: intentar con 'free' si todo falla
    logger.warn('Último recurso: usando listing_type free', {
      userId,
      categoryId,
    });
    return 'free';
  }
}

/**
 * Verifica si un listing_type específico está disponible para el usuario y categoría
 */
export async function isListingTypeAvailable(
  userId: number,
  categoryId: string,
  listingTypeId: string
): Promise<boolean> {
  try {
    const response = await makeAuthenticatedRequest(
      userId,
      `/users/${userId}/available_listing_type/${listingTypeId}?category_id=${categoryId}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      // Si responde 404 o similar, asumimos que no está disponible
      if (response.status === 404 || response.status === 400) {
        return false;
      }
      const error = await response.text();
      logger.error('Error verificando disponibilidad de listing type', {
        userId,
        categoryId,
        listingTypeId,
        error,
        status: response.status,
      });
      throw new MercadoLibreError(
        MercadoLibreErrorCode.INVALID_REQUEST,
        'Error verificando disponibilidad del tipo de publicación',
        { status: response.status, error }
      );
    }

    const data = await response.json();
    return data.available === true;
  } catch (error) {
    logger.error('Error en isListingTypeAvailable', {
      userId,
      categoryId,
      listingTypeId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
