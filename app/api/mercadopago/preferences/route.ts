import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { db } from '@/lib/db';
import { mercadopagoPreferences, orders } from '@/lib/schema';
import { eq, and, count } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import { auth } from '@/lib/actions/auth';

interface PreferenceResponse {
  id: string;
  external_reference: string;
  init_point: string;
  items: Array<unknown>;
  payer: Record<string, unknown>;
  payment_methods: Record<string, unknown>;
  expires: boolean;
  expiration_date_from?: string;
  expiration_date_to?: string;
  notification_url?: string;
}

interface PreferenceRequest {
  orderId?: number;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unit_price: number;
    currency_id?: string;
    picture_url?: string;
    description?: string;
    category_id?: string;
  }>;
  payer?: {
    name?: string;
    surname?: string;
    email?: string;
    phone?: {
      area_code?: string;
      number?: string;
    };
    identification?: {
      type?: string;
      number?: string;
    };
    address?: {
      street_name?: string;
      street_number?: string;
      zip_code?: string;
    };
  };
  paymentMethods?: {
    excluded_payment_methods?: Array<{
      id: string;
    }>;
    excluded_payment_types?: Array<{
      id: string;
    }>;
    installments?: number;
    default_installments?: number;
  };
  backUrls?: {
    success?: string;
    pending?: string;
    failure?: string;
  };
  autoReturn?: 'approved' | 'pending';
  notificationUrl?: string;
  expires?: boolean;
  expirationDateFrom?: string;
  expirationDateTo?: string;
  externalReference?: string;
  statementDescriptor?: string;
}


// Configuración de Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
  options: { timeout: 5000 },
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body: PreferenceRequest = await req.json();

    // Validar datos requeridos
    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ 
        error: 'Se requiere al menos un item' 
      }, { status: 400 });
    }

    // Validar que cada item tenga los campos requeridos
    for (const item of body.items) {
      if (!item.id || !item.title || !item.quantity || !item.unit_price) {
        return NextResponse.json({ 
          error: 'Cada item debe tener id, title, quantity y unit_price' 
        }, { status: 400 });
      }
    }

    // Si se proporciona orderId, verificar que exista y pertenezca al usuario
    let order = null;
    if (body.orderId) {
      order = await db.query.orders.findFirst({
        where: eq(orders.id, body.orderId),
      });

      if (!order) {
        return NextResponse.json({ 
          error: 'Orden no encontrada' 
        }, { status: 404 });
      }

      if (order.userId !== parseInt(session.user.id)) {
        return NextResponse.json({ 
          error: 'La orden no pertenece al usuario' 
        }, { status: 403 });
      }
    }

    // Crear preferencia en Mercado Pago
    const preference = new Preference(client);

    const preferenceData: PreferenceRequest & Record<string, unknown> = {
      items: body.items.map(item => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
        currency_id: item.currency_id || 'ARS',
        picture_url: item.picture_url,
        description: item.description || item.title,
        category_id: item.category_id || 'others', // Mejorar tasa de aprobación
      })),
      payer: body.payer,
      payment_methods: body.paymentMethods,
      back_urls: {
        success: body.backUrls?.success || `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
        pending: body.backUrls?.pending || `${process.env.NEXT_PUBLIC_APP_URL}/payment/pending`,
        failure: body.backUrls?.failure || `${process.env.NEXT_PUBLIC_APP_URL}/payment/failure`,
      },
      auto_return: body.autoReturn || 'approved',
      notification_url: body.notificationUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
      external_reference: body.externalReference || `order_${body.orderId || 'direct'}_${Date.now()}`,
      statement_descriptor: body.statementDescriptor || process.env.MERCADO_PAGO_STATEMENT_DESCRIPTOR || 'PROTOTYPE MARKETPLACE', // Reducir contracargos
      expires: body.expires || false,
    };

    // Agregar fechas de expiración si se solicita
    if (body.expires && body.expirationDateFrom && body.expirationDateTo) {
      preferenceData.expiration_date_from = body.expirationDateFrom;
      preferenceData.expiration_date_to = body.expirationDateTo;
    }

    // Crear preferencia en Mercado Pago
    const preferenceResponse = await preference.create({ body: preferenceData }) as PreferenceResponse;

    // Guardar preferencia en base de datos
    await db.insert(mercadopagoPreferences).values({
      preferenceId: preferenceResponse.id,
      externalReference: preferenceResponse.external_reference,
      orderId: body.orderId || null,
      userId: parseInt(session.user.id),
      initPoint: preferenceResponse.init_point,
      items: preferenceResponse.items || [],
      payer: preferenceResponse.payer || {},
      paymentMethods: preferenceResponse.payment_methods || {},
      expires: preferenceResponse.expires,
      expirationDateFrom: preferenceResponse.expiration_date_from ? new Date(preferenceResponse.expiration_date_from) : null,
      expirationDateTo: preferenceResponse.expiration_date_to ? new Date(preferenceResponse.expiration_date_to) : null,
      notificationUrl: preferenceResponse.notification_url,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info('Preferencia de Mercado Pago creada', {
      preferenceId: preferenceResponse.id,
      externalReference: preferenceResponse.external_reference,
      orderId: body.orderId,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      preference: {
        id: preferenceResponse.id,
        initPoint: preferenceResponse.init_point,
        externalReference: preferenceResponse.external_reference,
        expires: preferenceResponse.expires,
        expirationDateFrom: preferenceResponse.expiration_date_from,
        expirationDateTo: preferenceResponse.expiration_date_to,
      },
      items: body.items,
      total: body.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0),
    });

  } catch (error) {
    logger.error('Error creando preferencia de Mercado Pago', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const preferenceId = searchParams.get('preferenceId');
    const orderId = searchParams.get('orderId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (preferenceId) {
      // Obtener preferencia específica
      const preference = await db.query.mercadopagoPreferences.findFirst({
        where: eq(mercadopagoPreferences.preferenceId, preferenceId),
        with: {
          order: true,
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!preference) {
        return NextResponse.json({ error: 'Preferencia no encontrada' }, { status: 404 });
      }

      // Verificar que pertenezca al usuario
      if (preference.userId !== parseInt(session.user.id)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }

      return NextResponse.json(preference);
    } else {
      // Obtener preferencias con filtros
      const whereConditions = [eq(mercadopagoPreferences.userId, parseInt(session.user.id))];
      
      if (orderId) {
        whereConditions.push(eq(mercadopagoPreferences.orderId, parseInt(orderId)));
      }
      
      if (status) {
        whereConditions.push(eq(mercadopagoPreferences.status, status as 'pending' | 'expired' | 'active'));
      }

      const whereCondition = whereConditions.length === 1 
        ? whereConditions[0] 
        : and(...whereConditions);

      const preferences = await db.query.mercadopagoPreferences.findMany({
        where: whereCondition,
        with: {
          order: {
            columns: {
              id: true,
              total: true,
              status: true,
              createdAt: true,
            },
          },
        },
        limit,
        offset,
        orderBy: (mercadopagoPreferences, { desc }) => [
          desc(mercadopagoPreferences.createdAt),
        ],
      });

      // Obtener estadísticas
      const stats = await db
        .select({
          status: mercadopagoPreferences.status,
          count: count(mercadopagoPreferences.id),
        })
        .from(mercadopagoPreferences)
        .where(eq(mercadopagoPreferences.userId, parseInt(session.user.id)))
        .groupBy(mercadopagoPreferences.status);

      return NextResponse.json({
        preferences,
        stats,
        pagination: {
          limit,
          offset,
          total: preferences.length,
        },
      });
    }

  } catch (error) {
    logger.error('Error obteniendo preferencias', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { preferenceId, status } = await req.json();

    if (!preferenceId || !status) {
      return NextResponse.json({ 
        error: 'preferenceId y status son requeridos' 
      }, { status: 400 });
    }

    // Verificar que la preferencia exista y pertenezca al usuario
    const existingPreference = await db.query.mercadopagoPreferences.findFirst({
      where: eq(mercadopagoPreferences.preferenceId, preferenceId),
    });

    if (!existingPreference) {
      return NextResponse.json({ 
        error: 'Preferencia no encontrada' 
      }, { status: 404 });
    }

    if (existingPreference.userId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Actualizar estado
    const updatedPreference = await db.update(mercadopagoPreferences)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(mercadopagoPreferences.preferenceId, preferenceId))
      .returning();

    logger.info('Estado de preferencia actualizado', {
      preferenceId,
      status,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      preference: updatedPreference[0],
    });

  } catch (error) {
    logger.error('Error actualizando preferencia', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const preferenceId = searchParams.get('preferenceId');

    if (!preferenceId) {
      return NextResponse.json({ 
        error: 'preferenceId es requerido' 
      }, { status: 400 });
    }

    // Verificar que la preferencia exista y pertenezca al usuario
    const existingPreference = await db.query.mercadopagoPreferences.findFirst({
      where: eq(mercadopagoPreferences.preferenceId, preferenceId),
    });

    if (!existingPreference) {
      return NextResponse.json({ 
        error: 'Preferencia no encontrada' 
      }, { status: 404 });
    }

    if (existingPreference.userId !== parseInt(session.user.id)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Marcar como expirada en lugar de eliminar (para mantener auditoría)
    await db.update(mercadopagoPreferences)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(eq(mercadopagoPreferences.preferenceId, preferenceId));

    logger.info('Preferencia marcada como expirada', {
      preferenceId,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Preferencia marcada como expirada',
    });

  } catch (error) {
    logger.error('Error eliminando preferencia', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
