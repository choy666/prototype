import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { validateProductME2Attributes } from '@/lib/validations/me2-products';
import { logger } from '@/lib/utils/logger';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void _request;
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id, 10);

    if (Number.isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const result = await validateProductME2Attributes(productId);

    logger.info('[ME2] Admin product validation requested', {
      productId,
      isValid: result.isValid,
      canUseME2: result.canUseME2,
      missingAttributesCount: result.missingAttributes.length,
    });

    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[ME2] Error in admin product ME2 validation endpoint', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
