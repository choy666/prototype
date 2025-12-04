// app/api/admin/webhooks/retry/[id]/route.ts

import { NextResponse, NextRequest } from 'next/server';
import { retryWebhook } from '@/lib/actions/webhook-failures';
import { logger } from '@/lib/utils/logger';
import { requireAdminAuth, createAdminErrorResponse } from '@/lib/middleware/admin-auth';
import { applyRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Aplicar rate limiting antes de cualquier otra operación
    const rateLimitResult = await applyRateLimit(
      req, 
      RATE_LIMIT_CONFIGS.CRITICAL,
      `webhook-retry-${id}`
    );
    
    if (!rateLimitResult.success && rateLimitResult.response) {
      return rateLimitResult.response;
    }

    // Verificar autenticación de admin
    const { user } = await requireAdminAuth(req);
    
    const webhookId = parseInt(id);
    
    if (isNaN(webhookId)) {
      return NextResponse.json(
        { error: 'ID de webhook inválido' },
        { status: 400 }
      );
    }

    logger.info('Retry manual de webhook solicitado', {
      webhookId,
      adminUser: user.email,
      userId: user.id,
      userAgent: req.headers.get('user-agent'),
    });

    const result = await retryWebhook(webhookId);

    // Auditoría de acción manual
    logger.warn('[AUDIT] Webhook reintentado manualmente por admin', {
      webhookId,
      adminUser: user.email,
      userId: user.id,
      result: result.status,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook reintentado exitosamente',
      webhookId,
      status: result.status,
      retriedBy: user.email,
      retriedAt: new Date().toISOString(),
    });

  } catch (error) {
    // Error de autenticación
    if (error instanceof Error && error.message.includes('autorización')) {
      return createAdminErrorResponse(error.message);
    }

    logger.error('Error en retry manual de webhook', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { 
        error: 'Error reintentando webhook',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const webhookId = parseInt(id);
    
    if (isNaN(webhookId)) {
      return NextResponse.json(
        { error: 'ID de webhook inválido' },
        { status: 400 }
      );
    }

    // TODO: Implementar getWebhookById en webhook-failures.ts
    return NextResponse.json({
      message: 'Endpoint GET para obtener detalles del webhook - pendiente de implementar',
      webhookId,
    });

  } catch (error) {
    logger.error('Error obteniendo webhook', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    return NextResponse.json(
      { error: 'Error obteniendo webhook' },
      { status: 500 }
    );
  }
}
