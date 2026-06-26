import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
import { getListingTypesForCategory } from '@/lib/mercadolibre/category-settings';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get('categoryId') || undefined;
  const preferredListingType = searchParams.get('preferred') || undefined;

  try {
    const session = await auth().catch(() => null);
    const userId = session?.user?.id ? parseInt(session.user.id) : undefined;

    const listingRules = await getListingTypesForCategory({
      categoryId,
      userId,
    });

    return NextResponse.json({
      ...listingRules,
      preferredListingType,
    });
  } catch (error) {
    logger.error('Error interno obteniendo listing_types consolidados', {
      categoryId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
