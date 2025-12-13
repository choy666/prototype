import { NextResponse } from 'next/server';
import { MercadoPagoConfig, User } from 'mercadopago';
import { logger } from '@/lib/utils/logger';
import { requireAdminAuth } from '@/lib/auth/admin-auth';

export async function GET() {
  try {
    // Verificar autenticación de admin
    await requireAdminAuth();
    
    logger.info('Obteniendo estado de MercadoPago');

    // Verificar configuración básica
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`
      : undefined;

    if (!accessToken) {
      return NextResponse.json({
        connected: false,
        environment: 'sandbox',
        hasWebhookSecret: false,
        webhookUrl,
        error: 'MERCADO_PAGO_ACCESS_TOKEN no configurado'
      });
    }

    // Detectar si es sandbox
    const isSandbox = accessToken.startsWith('TEST-');

    // Obtener información de la cuenta
    let accountInfo = null;
    let lastTest = null;
    
    try {
      const client = new MercadoPagoConfig({ 
        accessToken,
        options: { timeout: 5000 }
      });
      const userClient = new User(client);
      
      const startTime = Date.now();
      accountInfo = await userClient.get();
      const responseTime = Date.now() - startTime;

      lastTest = {
        success: true,
        responseTime: `${responseTime}ms`,
        message: 'Conexión exitosa',
        timestamp: new Date().toISOString()
      };

      logger.info('Estado de MercadoPago: Conectado', {
        accountId: accountInfo.id,
        environment: isSandbox ? 'sandbox' : 'production',
        responseTime: `${responseTime}ms`
      });

    } catch (error) {
      logger.error('Error obteniendo información de la cuenta MercadoPago:', error);
      lastTest = {
        success: false,
        responseTime: 'N/A',
        message: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString()
      };
    }

    // Obtener últimos eventos de webhook (simulado por ahora)
    const webhookEvents = await getRecentWebhookEvents();

    const status = {
      connected: !!accountInfo,
      accountId: accountInfo?.id,
      accountType: accountInfo?.site_id,
      environment: isSandbox ? 'sandbox' : 'production' as const,
      publicKey,
      hasWebhookSecret: !!webhookSecret,
      webhookUrl,
      lastTest,
      webhookEvents
    };

    return NextResponse.json(status);

  } catch (error) {
    logger.error('Error obteniendo estado de MercadoPago:', error);
    return NextResponse.json({
      connected: false,
      environment: 'sandbox',
      hasWebhookSecret: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

async function getRecentWebhookEvents() {
  try {
    // Por ahora, simular algunos eventos. En una implementación real,
    // esto vendría de una tabla de logs de webhooks
    return [
      {
        id: 'evt_001',
        type: 'payment.updated',
        status: 'processed' as const,
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        paymentId: '123456789'
      },
      {
        id: 'evt_002',
        type: 'payment.created',
        status: 'received' as const,
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        paymentId: '987654321'
      },
      {
        id: 'evt_003',
        type: 'payment.updated',
        status: 'failed' as const,
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        paymentId: '456789123'
      }
    ];
  } catch (error) {
    logger.error('Error obteniendo eventos de webhook:', error);
    return [];
  }
}
