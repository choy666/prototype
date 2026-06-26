import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { 
  getDailyMetricsSummary, 
  getIntegrationMetrics, 
  getPlatformMetricsSummary,
  recordMercadoLibreMetrics,
  recordMercadoPagoMetrics
} from '@/lib/services/metrics';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const platform = searchParams.get('platform') as 'mercadolibre' | 'mercadopago' | null;
    const metricName = searchParams.get('metricName');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const days = searchParams.get('days');
    
    // Si se solicita resumen diario específico
    if (date) {
      const targetDate = new Date(date);
      const metrics = await getDailyMetricsSummary(targetDate);
      
      return NextResponse.json({
        type: 'daily_summary',
        date: targetDate,
        metrics,
      });
    }
    
    // Si se solicitan métricas específicas con rango de fechas
    if (platform && metricName && startDate && endDate) {
      const metrics = await getIntegrationMetrics(
        platform,
        metricName,
        new Date(startDate),
        new Date(endDate)
      );
      
      return NextResponse.json({
        type: 'specific_metrics',
        platform,
        metricName,
        startDate,
        endDate,
        metrics,
      });
    }
    
    // Si se solicita resumen por plataforma
    if (platform) {
      const daysNumber = days ? parseInt(days) : 7;
      const summary = await getPlatformMetricsSummary(platform, daysNumber);
      
      return NextResponse.json({
        type: 'platform_summary',
        platform,
        days: daysNumber,
        summary,
      });
    }
    
    // Por defecto, retornar resumen del día actual
    const metrics = await getDailyMetricsSummary(new Date());

    return NextResponse.json({
      type: 'daily_summary',
      date: new Date(),
      metrics,
    });

  } catch (error) {
    console.error('Error obteniendo métricas:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { action, platform } = body;

    // Acciones para registrar métricas manualmente
    if (action === 'record_metrics') {
      const userId = parseInt(session.user.id);
      
      if (platform === 'mercadolibre') {
        await recordMercadoLibreMetrics(userId);
      } else if (platform === 'mercadopago') {
        await recordMercadoPagoMetrics(userId);
      } else {
        // Registrar métricas para ambas plataformas
        await Promise.all([
          recordMercadoLibreMetrics(userId),
          recordMercadoPagoMetrics(userId),
        ]);
      }

      return NextResponse.json({
        success: true,
        message: `Métricas registradas para ${platform || 'ambas plataformas'}`,
      });
    }

    return NextResponse.json({
      error: 'Acción no válida',
    }, { status: 400 });

  } catch (error) {
    console.error('Error en POST metrics:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
