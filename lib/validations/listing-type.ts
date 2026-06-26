import {
  getListingTypesForCategory,
  type CategoryListingRules,
  type ListingTypeRule,
} from '@/lib/mercadolibre/category-settings';

type ValidateListingTypeParams = {
  userId?: number;
  mlCategoryId?: string;
  mlListingTypeId: string;
  price: number;
};

type ListingTypeValidationMeta = {
  source?: CategoryListingRules['source'];
};

export class ListingTypeValidationError extends Error {
  meta?: ListingTypeValidationMeta;

  constructor(message: string, meta?: ListingTypeValidationMeta) {
    super(message);
    this.name = 'ListingTypeValidationError';
    this.meta = meta;
  }
}

export type ListingTypeValidationResult = {
  listingTypeRule: ListingTypeRule;
  source: CategoryListingRules['source'];
};

export async function validateListingTypeSelection({
  userId,
  mlCategoryId,
  mlListingTypeId,
  price,
}: ValidateListingTypeParams): Promise<ListingTypeValidationResult> {
  if (!mlListingTypeId) {
    throw new ListingTypeValidationError('Debes seleccionar un tipo de publicación.');
  }

  if (!mlCategoryId) {
    throw new ListingTypeValidationError(
      'Debes seleccionar una categoría de Mercado Libre antes de elegir el tipo de publicación.',
      { source: 'category' }
    );
  }

  const rules = await getListingTypesForCategory({
    categoryId: mlCategoryId,
    userId,
  });
  const source = rules.source;

  const listingTypeRule = rules.listingTypes.find((lt) => lt.id === mlListingTypeId);

  if (!listingTypeRule) {
    throw new ListingTypeValidationError(
      `El tipo de publicación ${mlListingTypeId} no está disponible para esta categoría.`,
      { source }
    );
  }

  if (!listingTypeRule.available) {
    throw new ListingTypeValidationError(
      listingTypeRule.blockedReason ||
        `El tipo de publicación ${listingTypeRule.name ?? listingTypeRule.id} no está disponible actualmente.`,
      { source }
    );
  }

  if (listingTypeRule.priceRange) {
    const { min, max, currency } = listingTypeRule.priceRange;
    if (typeof min === 'number' && price < min) {
      throw new ListingTypeValidationError(
        `El precio mínimo para ${listingTypeRule.name ?? listingTypeRule.id} es ${min.toFixed(2)} ${currency ?? ''}`.trim(),
        { source }
      );
    }
    if (typeof max === 'number' && price > max) {
      throw new ListingTypeValidationError(
        `El precio máximo para ${listingTypeRule.name ?? listingTypeRule.id} es ${max.toFixed(2)} ${currency ?? ''}`.trim(),
        { source }
      );
    }
  }

  return { listingTypeRule, source };
}
