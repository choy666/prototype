import { db } from '@/lib/db';
import { categories } from '@/lib/schema';
import { getAvailableListingTypes } from '@/lib/actions/mercadolibre-listing-types';
import { MercadoLibreAuth } from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';
import { eq } from 'drizzle-orm';

type RawListingTypeSettings = {
  id: string;
  name?: string;
  settings?: {
    minimum_price?: number;
    maximum_price?: number;
    currency?: string;
  };
  sale_fee?: number;
  sale_fee_description?: string;
  sale_fee_amount?: number;
  sale_fee_currency?: string;
  sale_fee_percentage?: number;
};

export type ListingTypeRule = {
  id: string;
  name?: string;
  saleFeePercent?: number;
  saleFeeCurrency?: string;
  saleFeeAmount?: number;
  priceRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  remainingListings?: number | null;
  available: boolean;
  blockedReason?: string;
  source: 'user' | 'category' | 'site';
};

export type CategoryListingRules = {
  categoryId?: string;
  source: 'user' | 'category' | 'site';
  listingTypes: ListingTypeRule[];
};

const DEFAULT_SITE_ID = process.env.MERCADOLIBRE_SITE_ID || 'MLA';
const DEFAULT_LISTING_TYPES = ['free', 'gold_special'] as const;

export async function getListingTypesForCategory(params: {
  categoryId?: string;
  userId?: number;
}): Promise<CategoryListingRules> {
  const { categoryId, userId } = params;

  if (categoryId) {
    const category = await db.query.categories.findFirst({
      where: eq(categories.mlCategoryId, categoryId),
    });

    const storedListingTypes = extractListingTypesFromCategory(category);
    const userListingTypes = userId
      ? await safeGetAvailableListingTypes(userId, categoryId)
      : undefined;

    if (userListingTypes && userListingTypes.length > 0) {
      const listingTypes = mergeListingTypes(storedListingTypes, userListingTypes, 'user');
      return {
        categoryId,
        source: 'user',
        listingTypes,
      };
    }

    if (storedListingTypes.length > 0) {
      const listingTypes = storedListingTypes.map((lt) => ({
        ...lt,
        source: 'category' as const,
        available: true,
      }));
      return {
        categoryId,
        source: 'category',
        listingTypes,
      };
    }
  }

  const fallbackListingTypes = await fetchSiteListingTypes(DEFAULT_LISTING_TYPES);
  return {
    categoryId,
    source: 'site',
    listingTypes: fallbackListingTypes.map((lt) => ({
      ...lt,
      source: 'site' as const,
    })),
  };
}

function extractListingTypesFromCategory(
  category?: typeof categories.$inferSelect | null
): ListingTypeRule[] {
  if (!category || !category.mlSettings) {
    return [];
  }

  try {
    const { listing_types } = category.mlSettings as {
      listing_types?: RawListingTypeSettings[];
    };

    if (!Array.isArray(listing_types)) {
      return [];
    }

    return listing_types
      .filter((lt): lt is RawListingTypeSettings => Boolean(lt && typeof lt.id === 'string'))
      .map((lt) => ({
        id: lt.id,
        name: lt.name,
        saleFeePercent: lt.sale_fee_percentage ?? lt.sale_fee ?? undefined,
        saleFeeCurrency: lt.sale_fee_currency,
        saleFeeAmount: lt.sale_fee_amount,
        priceRange: lt.settings
          ? {
              min: lt.settings.minimum_price,
              max: lt.settings.maximum_price,
              currency: lt.settings.currency,
            }
          : undefined,
        remainingListings: null,
        available: true,
        source: 'category' as const,
      }));
  } catch (error) {
    logger.warn('CategorySettings: Error parseando mlSettings', {
      categoryId: category?.mlCategoryId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function mergeListingTypes(
  stored: ListingTypeRule[],
  userListingTypes: Array<{ id: string; name?: string; remaining_listings?: number | null }>,
  source: 'user' | 'category'
): ListingTypeRule[] {
  const storedMap = new Map(stored.map((lt) => [lt.id, lt]));

  return userListingTypes.map((userLt) => {
    const storedLt = storedMap.get(userLt.id);
    const saleFeePercent = storedLt?.saleFeePercent;
    const priceRange = storedLt?.priceRange;

    return {
      id: userLt.id,
      name: userLt.name || storedLt?.name,
      saleFeePercent,
      priceRange,
      saleFeeCurrency: storedLt?.saleFeeCurrency,
      saleFeeAmount: storedLt?.saleFeeAmount,
      remainingListings: userLt.remaining_listings ?? null,
      available: userLt.remaining_listings == null || userLt.remaining_listings > 0,
      blockedReason:
        typeof userLt.remaining_listings === 'number' && userLt.remaining_listings <= 0
          ? 'Sin cupos disponibles'
          : undefined,
      source,
    };
  });
}

async function safeGetAvailableListingTypes(userId: number, categoryId: string) {
  try {
    return await getAvailableListingTypes(userId, categoryId);
  } catch (error) {
    logger.warn(
      'CategorySettings: Error obteniendo listing types personalizados, usando fallback',
      {
        userId,
        categoryId,
        error: error instanceof Error ? error.message : String(error),
      }
    );
    return undefined;
  }
}

async function fetchSiteListingTypes(
  listingTypeIds: readonly string[]
): Promise<ListingTypeRule[]> {
  const auth = await MercadoLibreAuth.getInstance();
  const accessToken = await auth.getAccessToken();

  const results = await Promise.all(
    listingTypeIds.map(async (listingTypeId) => {
      try {
        const response = await fetch(
          `${process.env.MERCADOLIBRE_API_URL || 'https://api.mercadolibre.com'}/sites/${DEFAULT_SITE_ID}/listing_types/${listingTypeId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          logger.warn('CategorySettings: Error obteniendo listing_type del sitio', {
            listingTypeId,
            status: response.status,
          });
          return null;
        }

        const data = (await response.json()) as {
          id: string;
          configuration?: {
            name?: string;
            sale_fee_criteria?: {
              min_fee_amount?: number;
              max_fee_amount?: number;
              percentage_of_fee_amount?: number;
              currency?: string;
            };
          };
        };

        const listingType = {
          id: data.id,
          name: data.configuration?.name || listingTypeId,
          saleFeePercent: data.configuration?.sale_fee_criteria?.percentage_of_fee_amount,
          saleFeeCurrency: data.configuration?.sale_fee_criteria?.currency,
          priceRange: {
            min: data.configuration?.sale_fee_criteria?.min_fee_amount,
            max: data.configuration?.sale_fee_criteria?.max_fee_amount,
            currency: data.configuration?.sale_fee_criteria?.currency,
          },
          remainingListings: null,
          available: true,
          source: 'site' as const,
        } as ListingTypeRule;

        return listingType;
      } catch (error) {
        logger.error('CategorySettings: Error interno obteniendo listing_types de sitio', {
          listingTypeId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return null;
      }
    })
  );

  return results.filter((lt): lt is ListingTypeRule => lt !== null);
}
