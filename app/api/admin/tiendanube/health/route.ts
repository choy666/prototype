import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tiendanubeStores, tiendanubeProductMapping } from '@/lib/schema';
import { eq, count } from 'drizzle-orm';
import { createTiendanubeClient } from '@/lib/clients/tiendanube';
import { decryptString } from '@/lib/utils/encryption';
import { auth } from '@/lib/actions/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    // Verificar rate limiting
    const rateLimitResponse = checkRateLimit(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Verificar autenticación de admin
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID es requerido' },
        { status: 400 }
      );
    }

    // 1. Verificar configuración básica
    const store = await db.query.tiendanubeStores.findFirst({
      where: eq(tiendanubeStores.storeId, storeId),
    });

    if (!store) {
      return NextResponse.json({
        status: 'error',
        message: 'Tienda no configurada',
        checks: {
          configured: false,
          connected: false,
          hasToken: false,
        },
      });
    }

    const checks: {
      configured: boolean;
      connected: boolean;
      hasToken: boolean;
      lastSync?: Date | null;
      installedAt?: Date | null;
      apiConnection?: {
        status: string;
        storeName?: string;
        storeId?: string | number;
        message?: string;
      };
      productMapping?: {
        total: number;
        status: string;
      };
      webhooks?: {
        status: string;
        message?: string;
      };
    } = {
      configured: true,
      connected: store.status === 'connected',
      hasToken: !!store.accessTokenEncrypted,
      lastSync: store.lastSyncAt,
      installedAt: store.installedAt,
    };

    // 2. Verificar conexión con API de Tiendanube
    if (store.accessTokenEncrypted) {
      try {
        const client = createTiendanubeClient({
        storeId,
        accessToken: decryptString(store.accessTokenEncrypted)
      });
        const storeInfo = await client.get('/store') as {
          id: string | number;
          name: string;
        };
        checks.apiConnection = {
          status: 'ok',
          storeName: storeInfo.name,
          storeId: storeInfo.id,
        };
      } catch (error) {
        checks.apiConnection = {
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // 3. Verificar productos mapeados
    const [productCount] = await db
      .select({ count: count() })
      .from(tiendanubeProductMapping)
      .where(eq(tiendanubeProductMapping.storeId, storeId));

    checks.productMapping = {
      total: productCount.count,
      status: productCount.count > 0 ? 'ok' : 'warning',
    };

    // 4. Verificar webhooks (simulado - requeriría llamada a API)
    checks.webhooks = {
      status: 'unknown',
      message: 'Verificar en panel principal',
    };

    // 5. Estado general
    const overallStatus = 
      checks.configured && 
      checks.connected && 
      checks.hasToken && 
      checks.apiConnection?.status === 'ok' &&
      checks.productMapping.total > 0
        ? 'healthy'
        : 'unhealthy';

    return NextResponse.json({
      status: overallStatus,
      storeId,
      timestamp: new Date().toISOString(),
      checks,
    });

  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
