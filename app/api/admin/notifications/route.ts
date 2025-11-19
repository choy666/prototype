import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/actions/auth'
import { db } from '@/lib/db'
import { notifications } from '@/lib/schema'
import { eq, desc, and, count } from 'drizzle-orm'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    // Verificar rate limiting
    const rateLimitResponse = checkRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50) // Max 50
    const offset = parseInt(searchParams.get('offset') || '0')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    // Construir condiciones de filtro
    const conditions = []
    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false))
    }

    // Obtener notificaciones
    const notificationsData = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        data: notifications.data,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset)

    // Obtener conteo total
    const countQuery = await db
      .select({ count: count() })
      .from(notifications)
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    const total = countQuery[0]?.count ?? 0

    // Obtener conteo de no leídas
    const unreadCountQuery = await db
      .select({ count: count() })
      .from(notifications)
      .where(eq(notifications.isRead, false))

    const unreadCount = unreadCountQuery[0]?.count ?? 0

    return NextResponse.json({
      notifications: notificationsData.map(notification => ({
        ...notification,
        data: typeof notification.data === 'object' && notification.data !== null ? notification.data : {},
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      unreadCount,
    })
  } catch (error) {
    logger.error('Error fetching notifications', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (await auth())?.user?.id,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Verificar rate limiting
    const rateLimitResponse = checkRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const session = await auth()
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationIds, markAsRead } = body

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json({ error: 'Invalid notification IDs' }, { status: 400 })
    }

    // Marcar notificaciones como leídas/no leídas
    await db
      .update(notifications)
      .set({ isRead: markAsRead })
      .where(
        and(
          ...notificationIds.map(id => eq(notifications.id, id))
        )
      )

    logger.info('Notifications updated', {
      userId: session.user.id,
      notificationIds,
      markAsRead,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error updating notifications', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (await auth())?.user?.id,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
