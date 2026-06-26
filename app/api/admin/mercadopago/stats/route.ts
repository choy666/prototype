import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from '@/lib/db';
import { mercadopagoPayments } from '@/lib/schema';
import { count, sum, eq, gte, and } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import { requireAdminAuth } from '@/lib/auth/admin-auth';

export async function GET() {
  try {
    // Verificar autenticación de admin
    await requireAdminAuth();
    
    logger.info('Obteniendo estadísticas de MercadoPago');

    // Verificar configuración
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({
        error: 'MercadoPago no configurado'
      }, { status: 400 });
    }

    // Obtener estadísticas de los últimos 30 días
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Estadísticas de la base de datos local
    const [localStats] = await db
      .select({
        total: count(mercadopagoPayments.id),
        approved: count(
          and(
            eq(mercadopagoPayments.status, 'approved'),
            gte(mercadopagoPayments.createdAt, thirtyDaysAgo)
          )
        ),
        rejected: count(
          and(
            eq(mercadopagoPayments.status, 'rejected'),
            gte(mercadopagoPayments.createdAt, thirtyDaysAgo)
          )
        ),
        pending: count(
          and(
            eq(mercadopagoPayments.status, 'pending'),
            gte(mercadopagoPayments.createdAt, thirtyDaysAgo)
          )
        ),
        totalAmount: sum(mercadopagoPayments.amount).mapWith(Number)
      })
      .from(mercadopagoPayments)
      .where(
        gte(mercadopagoPayments.createdAt, thirtyDaysAgo)
      );

    // Obtener estadísticas adicionales desde API de MercadoPago si es necesario
    let apiStats = null;
    try {
      const client = new MercadoPagoConfig({ 
        accessToken,
        options: { timeout: 5000 }
      });
      const paymentClient = new Payment(client);

      // Buscar pagos recientes (limitado a 50 para no sobrecargar)
      const searchResult = await paymentClient.search({
        options: {
          beginDate: thirtyDaysAgo.toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          limit: 50,
          offset: 0
        }
      });

      // Procesar resultados de la API
      apiStats = {
        apiTotal: searchResult.paging?.total || 0,
        apiApproved: searchResult.results?.filter(p => p.status === 'approved').length || 0,
        apiRejected: searchResult.results?.filter(p => p.status === 'rejected').length || 0,
        apiPending: searchResult.results?.filter(p => p.status === 'pending').length || 0,
        apiAmount: searchResult.results
          ?.filter(p => p.status === 'approved')
          ?.reduce((sum, p) => sum + (p.transaction_amount || 0), 0) || 0
      };

      logger.info('Estadísticas API de MercadoPago obtenidas', {
        apiTotal: apiStats.apiTotal,
        apiApproved: apiStats.apiApproved
      });

    } catch (apiError) {
      logger.warn('No se pudieron obtener estadísticas de la API de MercadoPago:', apiError);
      // Continuar con estadísticas locales aunque falle la API
    }

    // Combinar estadísticas (priorizar datos locales)
    const stats = {
      totalPayments: localStats.total || 0,
      approvedPayments: localStats.approved || 0,
      rejectedPayments: localStats.rejected || 0,
      pendingPayments: localStats.pending || 0,
      totalAmount: localStats.totalAmount || 0,
      period: 'últimos 30 días',
      ...(apiStats && { api: apiStats })
    };

    return NextResponse.json(stats);

  } catch (error) {
    logger.error('Error obteniendo estadísticas de MercadoPago:', error);
    return NextResponse.json({
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}
