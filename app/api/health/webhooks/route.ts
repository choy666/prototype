// app/api/health/webhooks/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/utils/logger';

export async function GET() {
  try {
    // Verificar que la tabla webhook_failures existe y es accesible
    const result = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'webhook_failures'
      );
    `);

    const tableExists = result.rows?.[0]?.exists || false;

    if (!tableExists) {
      logger.error('[HEALTH] Tabla webhook_failures no existe', {
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        status: 'unhealthy',
        error: 'webhook_failures table missing',
        message: 'La migración 0006_webhook_failures.sql no ha sido aplicada',
        required: true,
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }

    // Verificar estructura básica de la tabla
    const columns = await db.execute(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'webhook_failures' 
      ORDER BY ordinal_position;
    `);

    const requiredColumns = ['id', 'payment_id', 'request_id', 'raw_body', 'headers', 'status'];
    const existingColumns = (columns.rows as Record<string, unknown>[]).map((col) => String(col.column_name)).filter(Boolean);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      logger.error('[HEALTH] Columnas faltantes en webhook_failures', {
        missingColumns,
        existingColumns,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        status: 'unhealthy',
        error: 'webhook_failures table incomplete',
        message: 'Faltan columnas requeridas',
        missingColumns,
        existingColumns,
        required: true,
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }

    // Verificar variables de entorno críticas
    const requiredEnvVars = [
      'MERCADO_PAGO_ACCESS_TOKEN',
      'MERCADO_PAGO_WEBHOOK_SECRET',
      'JWT_SECRET'
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingEnvVars.length > 0) {
      logger.error('[HEALTH] Variables de entorno faltantes', {
        missingEnvVars,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        status: 'unhealthy',
        error: 'environment variables missing',
        message: 'Faltan variables de entorno críticas',
        missingEnvVars,
        required: true,
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }

    // Verificar conexión con Mercado Pago (opcional, no bloqueante)
    let mercadoPagoStatus = 'unknown';
    try {
      const mpResponse = await fetch('https://api.mercadopago.com/users/me', {
        headers: {
          'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        },
        signal: AbortSignal.timeout(5000), // 5 segundos timeout
      });

      mercadoPagoStatus = mpResponse.ok ? 'connected' : 'error';
    } catch (error) {
      mercadoPagoStatus = 'connection_error';
      logger.warn('[HEALTH] No se puede verificar conexión con Mercado Pago', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logger.info('[HEALTH] Verificación completada exitosamente', {
      tableExists: true,
      columnsCount: existingColumns.length,
      mercadoPagoStatus,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      status: 'healthy',
      message: 'Sistema listo para procesar webhooks',
      checks: {
        database: {
          tableExists: true,
          columnsCount: existingColumns.length,
          requiredColumnsPresent: true,
        },
        environment: {
          allRequiredVarsPresent: true,
          varsChecked: requiredEnvVars.length,
        },
        mercadoPago: {
          status: mercadoPagoStatus,
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('[HEALTH] Error en verificación de salud', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({
      status: 'error',
      error: 'health_check_failed',
      message: 'Error interno en verificación de salud',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
