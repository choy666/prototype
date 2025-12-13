'use server';

import { db } from '@/lib/db';
import { 
  orders, 
  products, 
  users,
  mercadolibreProductsSync,
  categories 
} from '@/lib/schema';
import { 
  count, 
  sum, 
  eq, 
  gte, 
  lte, 
  and,
  sql,
  desc,
  lt 
} from 'drizzle-orm';
import { auth } from '@/lib/auth';

// Obtener métricas principales para el dashboard
export async function getDashboardMetrics() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      throw new Error('No autorizado');
    }

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    // Ejecutar todas las consultas en paralelo
    const [
      totalSalesResult,
      todaySalesResult,
      monthlyRevenueResult,
      pendingOrdersResult,
      totalOrdersResult,
      totalProductsResult,
      outOfStockResult,
      totalUsersResult,
      recentOrdersResult,
      topProductsResult,
      me2IncompatibleResult
    ] = await Promise.all([
      // Ventas de hoy
      db.select({ count: count() })
        .from(orders)
        .where(and(
          gte(orders.createdAt, startOfToday),
          lte(orders.createdAt, endOfToday),
          eq(orders.status, 'paid')
        )),
      
      // Total de ventas hoy (sumatoria)
      db.select({ total: sum(orders.total) })
        .from(orders)
        .where(and(
          gte(orders.createdAt, startOfToday),
          lte(orders.createdAt, endOfToday),
          eq(orders.status, 'paid')
        )),
      
      // Ingresos del mes
      db.select({ total: sum(orders.total) })
        .from(orders)
        .where(and(
          gte(orders.createdAt, startOfMonth),
          eq(orders.status, 'paid')
        )),
      
      // Pedidos pendientes
      db.select({ count: count() })
        .from(orders)
        .where(eq(orders.status, 'pending')),
      
      // Total de pedidos
      db.select({ count: count() })
        .from(orders),
      
      // Total de productos
      db.select({ count: count() })
        .from(products),
      
      // Productos sin stock
      db.select({ count: count() })
        .from(products)
        .where(lt(products.stock, 5)),
      
      // Total de usuarios
      db.select({ count: count() })
        .from(users),
      
      // Pedidos recientes (últimos 5)
      db.select({
        id: orders.id,
        total: orders.total,
        status: orders.status,
        createdAt: orders.createdAt,
        email: orders.email,
      })
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(5),
      
      // Productos más vendidos (usando datos disponibles)
      db.select({
        id: products.id,
        name: products.name,
        price: products.price,
        stock: products.stock,
        soldCount: sql<number>`0`.as('sold_count'), // Placeholder hasta tener datos reales
      })
        .from(products)
        .orderBy(desc(products.id))
        .limit(5),
      
      // Productos no compatibles con ME2
      db.select({ count: count() })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(eq(products.me2Compatible, false))
    ]);

    // Formatear resultados
    const metrics = {
      salesToday: Number(totalSalesResult[0]?.count || 0),
      revenueToday: Number(todaySalesResult[0]?.total || 0),
      revenueMonth: Number(monthlyRevenueResult[0]?.total || 0),
      pendingOrders: Number(pendingOrdersResult[0]?.count || 0),
      totalOrders: Number(totalOrdersResult[0]?.count || 0),
      totalProducts: Number(totalProductsResult[0]?.count || 0),
      outOfStock: Number(outOfStockResult[0]?.count || 0),
      totalUsers: Number(totalUsersResult[0]?.count || 0),
      me2Incompatible: Number(me2IncompatibleResult[0]?.count || 0),
      recentOrders: recentOrdersResult.map(order => ({
        ...order,
        total: Number(order.total)
      })),
      topProducts: topProductsResult.map(product => ({
        ...product,
        price: Number(product.price)
      }))
    };

    return { success: true, metrics };
  } catch (error) {
    console.error('[Dashboard] Error al obtener métricas:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

// Obtener estadísticas de Mercado Libre
export async function getMercadoLibreStats() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      throw new Error('No autorizado');
    }

    const [
      totalSynced,
      activePublications,
      totalMLSales,
      lastSync
    ] = await Promise.all([
      // Productos sincronizados con ML
      db.select({ count: count() })
        .from(mercadolibreProductsSync),
      
      // Publicaciones activas
      db.select({ count: count() })
        .from(mercadolibreProductsSync)
        .where(eq(mercadolibreProductsSync.syncStatus, 'synced')),
      
      // Total ventas en ML (placeholder)
      db.select({ total: sql<number>`0`.as('total_sales') })
        .from(mercadolibreProductsSync)
        .limit(1),
      
      // Última sincronización
      db.select({ 
        date: sql<Date>`MAX(updated_at)`.as('last_sync') 
      })
        .from(mercadolibreProductsSync)
    ]);

    return {
      totalSynced: Number(totalSynced[0]?.count || 0),
      activePublications: Number(activePublications[0]?.count || 0),
      totalMLSales: Number(totalMLSales[0]?.total || 0),
      lastSync: lastSync[0]?.date || null
    };
  } catch (error) {
    console.error('[Dashboard] Error al obtener estadísticas ML:', error);
    return null;
  }
}

// Obtener alertas importantes
export async function getDashboardAlerts() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      throw new Error('No autorizado');
    }

    const alerts = [];

    // Productos sin stock
    const outOfStock = await db
      .select({ name: products.name, stock: products.stock })
      .from(products)
      .where(lt(products.stock, 5))
      .limit(5);

    if (outOfStock.length > 0) {
      alerts.push({
        type: 'warning',
        title: 'Productos con bajo stock',
        description: `${outOfStock.length} productos tienen menos de 5 unidades`,
        items: outOfStock.map(p => `${p.name} (${p.stock} unidades)`)
      });
    }

    // Productos no compatibles con ME2
    const me2Incompatible = await db
      .select({ name: products.name })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.me2Compatible, false))
      .limit(5);

    if (me2Incompatible.length > 0) {
      alerts.push({
        type: 'info',
        title: 'Productos no compatibles con Mercado Envíos 2',
        description: `${me2Incompatible.length} productos no pueden ser enviados por ME2`,
        items: me2Incompatible.map(p => p.name)
      });
    }

    return alerts;
  } catch (error) {
    console.error('[Dashboard] Error al obtener alertas:', error);
    return [];
  }
}
