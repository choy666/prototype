import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { logger } from '@/lib/utils/logger';

export async function GET() {
  try {
    logger.info('Test de conexión Mercado Pago: Iniciando prueba');

    // Verificar variables de entorno
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

    // Detectar tokens placeholder
    const isPlaceholderToken = accessToken === 'TEST-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const isPlaceholderKey = publicKey === 'TEST-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const isPlaceholderSecret = webhookSecret === 'TEST-WEBHOOK-SECRET-LOCAL';

    const configCheck = {
      hasAccessToken: !!accessToken,
      hasPublicKey: !!publicKey,
      hasWebhookSecret: !!webhookSecret,
      accessTokenLength: accessToken?.length || 0,
      isTestToken: accessToken?.startsWith('TEST-') || false,
      isPlaceholderToken,
      isPlaceholderKey,
      isPlaceholderSecret,
      environment: process.env.NODE_ENV
    };

    logger.info('Test de conexión: Verificación de configuración', configCheck);

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'MERCADO_PAGO_ACCESS_TOKEN no configurado',
        config: configCheck,
        setupGuide: 'Consulta docs/CONFIGURACION_MERCADOPAGO.md para obtener instrucciones'
      }, { status: 500 });
    }

    if (isPlaceholderToken) {
      return NextResponse.json({
        success: false,
        error: 'Usando token placeholder de Mercado Pago',
        details: 'Reemplaza TEST-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX con un token real de sandbox',
        config: configCheck,
        setupGuide: 'Consulta docs/CONFIGURACION_MERCADOPAGO.md para obtener instrucciones paso a paso'
      }, { status: 400 });
    }

    // Intentar conexión con la API de Mercado Pago
    const client = new MercadoPagoConfig({
      accessToken: accessToken,
      options: { timeout: 5000 }
    });

    // Hacer una consulta simple para verificar conexión
    const paymentClient = new Payment(client);
    
    // Intentar buscar un pago de prueba (saber si la conexión funciona)
    const startTime = Date.now();
    try {
      // Usar un ID que no exista para probar la API sin afectar datos reales
      await paymentClient.get({ id: 'test-connection-12345' });
    } catch (apiError: unknown) {
      // Esperamos un error 404, lo que indica que la API responde correctamente
      const errorStatus = apiError && typeof apiError === 'object' && 'status' in apiError ? (apiError as { status: number }).status : undefined;
      if (errorStatus === 404) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        logger.info('Test de conexión: API responde correctamente', {
          responseTime: `${responseTime}ms`,
          statusCode: errorStatus
        });

        return NextResponse.json({
          success: true,
          message: 'Conexión a API de Mercado Pago exitosa',
          config: configCheck,
          apiTest: {
            connected: true,
            responseTime: `${responseTime}ms`,
            statusCode: errorStatus,
            message: 'API responde correctamente (error 404 esperado para ID de prueba)'
          }
        });
      } else {
        throw apiError;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Conexión a API de Mercado Pago verificada',
      config: configCheck
    });

  } catch (error) {
    logger.error('Test de conexión Mercado Pago: Error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      success: false,
      error: 'Error conectando a Mercado Pago API',
      details: error instanceof Error ? error.message : String(error),
      config: {
        hasAccessToken: !!process.env.MERCADO_PAGO_ACCESS_TOKEN,
        hasPublicKey: !!process.env.NEXT_PUBLIC_MP_PUBLIC_KEY,
        environment: process.env.NODE_ENV
      }
    }, { status: 500 });
  }
}

export async function POST() {
  // Endpoint para simular webhook de prueba
  try {
    logger.info('Test de webhook: Simulando webhook de prueba');

    const testPayload = {
      action: 'payment.updated',
      api_version: 'v1',
      data: {
        id: '123456789'
      },
      date_created: new Date().toISOString(),
      id: 'test-webhook-' + Date.now(),
      live_mode: false,
      type: 'payment',
      user_id: 'test-user'
    };

    // En desarrollo, podríamos simular el procesamiento
    if (process.env.NODE_ENV === 'development') {
      logger.info('Test de webhook: Payload de prueba generado', {
        payloadId: testPayload.id,
        action: testPayload.action,
        paymentId: testPayload.data.id
      });

      return NextResponse.json({
        success: true,
        message: 'Webhook de prueba generado correctamente',
        payload: testPayload,
        endpoint: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Endpoint de prueba solo disponible en desarrollo'
    }, { status: 400 });

  } catch (error) {
    logger.error('Test de webhook: Error', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({
      success: false,
      error: 'Error generando webhook de prueba'
    }, { status: 500 });
  }
}
