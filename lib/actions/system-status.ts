import { db } from '@/lib/db'

export interface SystemStatus {
  database: {
    status: 'connected' | 'disconnected'
    message: string
  }
  server: {
    status: 'operational' | 'error'
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
    server: {
      status: 'operational',
      message: 'Operativo'
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

  // Verificar estado del servidor (siempre operativo en este contexto)
  // Podríamos agregar más verificaciones aquí como memoria, CPU, etc.
  status.server = {
    status: 'operational',
    message: 'Operativo'
  }

  // Verificar estado de pagos (podríamos verificar configuración de MercadoPago)
  // Por ahora asumimos que está activo, pero podríamos agregar verificación real
  try {
    // Aquí podríamos verificar si las credenciales de MercadoPago están configuradas
    // o hacer una llamada de prueba a la API de MercadoPago
    status.payments = {
      status: 'active',
      message: 'Activo'
    }
  } catch (error) {
    console.error('Payments check error:', error)
    status.payments = {
      status: 'inactive',
      message: 'Error de configuración'
    }
  }

  return status
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'connected':
    case 'operational':
    case 'active':
      return 'text-green-600'
    case 'disconnected':
    case 'error':
    case 'inactive':
      return 'text-red-600'
    default:
      return 'text-yellow-600'
  }
}
