'use server';

import { db } from '@/lib/db';
import { orders, addresses } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function getCustomerOrders(email?: string | null) {
  try {
    if (!email) {
      return { success: false, error: 'Email no proporcionado' };
    }

    const customerOrders = await db
      .select({
        id: orders.id,
        total: orders.total,
        status: orders.status,
        createdAt: orders.createdAt,
        trackingCode: orders.trackingNumber,
      })
      .from(orders)
      .where(eq(orders.email, email))
      .orderBy(orders.createdAt)
      .limit(10);

    return { 
      success: true, 
      orders: customerOrders.map(order => ({
        ...order,
        total: parseFloat(order.total.toString()),
        createdAt: new Date(order.createdAt),
      }))
    };
  } catch (error) {
    console.error('Error al obtener pedidos del cliente:', error);
    return { success: false, error: 'Error al cargar pedidos' };
  }
}

export async function getCustomerAddresses() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    const customerAddresses = await db
      .select({
        id: addresses.id,
        street: addresses.direccion,
        city: addresses.ciudad,
        zipCode: addresses.codigoPostal,
        isDefault: addresses.isDefault,
      })
      .from(addresses)
      .where(eq(addresses.userId, parseInt(session.user.id)));

    return { success: true, addresses: customerAddresses };
  } catch (error) {
    console.error('Error al obtener direcciones del cliente:', error);
    return { success: false, error: 'Error al cargar direcciones' };
  }
}
