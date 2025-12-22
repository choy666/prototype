import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { triggerWebhookRetries } from '@/lib/services/tiendanube/webhook-retries';
import { logger } from '@/lib/utils/logger';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { storeId } = body;

    logger.info('Disparando retries de webhooks manualmente', {
      userId: session.user.id,
      storeId,
    });

    const result = await triggerWebhookRetries(storeId);

    return NextResponse.json({
      success: true,
      result,
      message: `Procesados: ${result.processed}, Fallidos: ${result.failed}, Dead letter: ${result.deadLetter}`,
    });
  } catch (error) {
    logger.error('Error disparando retries de webhooks', {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error procesando retries' },
      { status: 500 }
    );
  }
}
