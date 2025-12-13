import { db } from '@/lib/db'

interface CacheEntry {
  status: SystemStatus['payments'] | SystemStatus['mercadolibre']
  timestamp: number
}

// Cache en memoria para evitar rate limits (5 minutos)
const paymentStatusCache = new Map<string, CacheEntry>()
const mlStatusCache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

export interface SystemStatus {
  database: {
    status: 'connected' | 'disconnected'
    message: string
  }
  mercadolibre: {
    status: 'connected' | 'disconnected' | 'not_configured'
    message: string
  }
  payments: {
    status: 'active' | 'inactive'
    message: string
  }
}

export async function checkSystemStatus(): Promise<SystemStatus> {
  const status: SystemStatus = {
    database: {
      status: 'disconnected',
      message: 'Desconectada'
    },
    mercadolibre: {
      status: 'not_configured',
      message: 'No configurado'
    },
    payments: {
      status: 'active',
      message: 'Activo'
    }
  }

  // Verificar conexión a la base de datos
  try {
    await db.execute('SELECT 1')
    status.database = {
      status: 'connected',
      message: 'Conectada'
    }
  } catch (error) {
    console.error('Database connection error:', error)
    status.database = {
      status: 'disconnected',
      message: 'Error de conexión'
    }
  }

  // Verificar estado de MercadoLibre API
  const mlCacheKey = 'mercadolibre-status'
  const mlCached = mlStatusCache.get(mlCacheKey)
  const now = Date.now()
  
  // Usar caché si es válido
  if (mlCached && (now - mlCached.timestamp) < CACHE_TTL) {
    status.mercadolibre = mlCached.status as SystemStatus['mercadolibre']
  } else {
    try {
      // Obtener el primer usuario con token de ML
      const user = await db.query.users.findFirst({
        where: (users, { isNotNull }) => isNotNull(users.mercadoLibreAccessToken),
        columns: {
          mercadoLibreAccessToken: true,
          mercadoLibreId: true,
        },
      })
      
      if (!user?.mercadoLibreAccessToken) {
        status.mercadolibre = {
          status: 'not_configured',
          message: 'No conectado'
        }
      } else {
        // Verificar token con API de ML
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        
        const response = await fetch('https://api.mercadolibre.com/users/me', {
          headers: {
            'Authorization': `Bearer ${user.mercadoLibreAccessToken}`,
            'Accept': 'application/json'
          },
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const data = await response.json()
          console.log('[ML Status] Conectado - Usuario:', data.nickname || data.id)
          status.mercadolibre = {
            status: 'connected',
            message: 'Conectado'
          }
        } else {
          console.error('[ML Status] Error response:', response.status, response.statusText)
          status.mercadolibre = {
            status: 'disconnected',
            message: 'Error de API'
          }
        }
      }
    } catch (error) {
      console.error('[ML Status] Connection error:', error)
      status.mercadolibre = {
        status: 'disconnected',
        message: 'Error de conexión'
      }
    }
    
    // Guardar en caché
    mlStatusCache.set(mlCacheKey, {
      status: status.mercadolibre,
      timestamp: Date.now()
    })
  }

  // Verificar estado de pagos con MercadoPago API
  const cacheKey = 'mercadopago-status'
  const cached = paymentStatusCache.get(cacheKey)
  
  // Usar caché si es válido
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    status.payments = cached.status as SystemStatus['payments']
  } else {
    // Verificar si está configurado el token de MercadoPago
    if (!process.env.MP_ACCESS_TOKEN) {
      status.payments = {
        status: 'inactive',
        message: 'No configurado'
      }
    } else {
      try {
        // Hacer ping a API de MercadoPago para verificar conectividad
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // timeout de 5 segundos
        
        const response = await fetch('https://api.mercadopago.com/users/me', {
          headers: {
            'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`
          },
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const data = await response.json()
          console.log('[MP Status] Conectado - Usuario:', data.id || data.nickname)
          status.payments = {
            status: 'active',
            message: 'Activo'
          }
        } else {
          console.error('[MP Status] Error response:', response.status, response.statusText)
          status.payments = {
            status: 'inactive',
            message: 'Error de API'
          }
        }
      } catch (error) {
        console.error('[MP Status] Connection error:', error)
        status.payments = {
          status: 'inactive',
          message: 'Error de conexión'
        }
      }
    }
    
    // Guardar en caché
    paymentStatusCache.set(cacheKey, {
      status: status.payments,
      timestamp: now
    })
  }

  return status
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'connected':
    case 'active':
      return 'text-green-600'
    case 'disconnected':
    case 'inactive':
      return 'text-red-600'
    case 'not_configured':
      return 'text-yellow-600'
    default:
      return 'text-yellow-600'
  }
}
