import { db } from '../lib/db';
import { users, products, orders } from '../lib/schema';
import { count, sum, eq, gte, lte, and } from 'drizzle-orm';

async function verifyStats() {
  try {
    console.log('Verificando estadísticas del dashboard...\n');

    // Total usuarios
    const [userCount] = await db.select({ count: count() }).from(users);
    console.log(`Total Usuarios: ${userCount.count}`);

    // Total productos activos (stock > 0)
    const [productCount] = await db.select({ count: count() }).from(products).where(gte(products.stock, 1));
    console.log(`Total Productos: ${productCount.count}`);

    // Total pedidos
    const [orderCount] = await db.select({ count: count() }).from(orders);
    console.log(`Total Pedidos: ${orderCount.count}`);

    // Calcular ingresos totales de pedidos pagados
    const [revenueResult] = await db
      .select({ total: sum(orders.total) })
      .from(orders)
      .where(eq(orders.status, 'paid'));

    const revenue = Number(revenueResult?.total ?? 0);
    console.log(`Ingresos Totales: $${revenue.toLocaleString()}`);

    // Calcular tendencias para usuarios (último mes vs mes anterior)
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [lastMonthUsers] = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          gte(users.createdAt, lastMonthStart),
          lte(users.createdAt, lastMonthEnd)
        )
      );

    const [currentMonthUsers] = await db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, currentMonthStart));

    const lastMonthUserCount = lastMonthUsers.count;
    const currentMonthUserCount = currentMonthUsers.count;
    const userTrend = lastMonthUserCount > 0 ? ((currentMonthUserCount - lastMonthUserCount) / lastMonthUserCount) * 100 : (currentMonthUserCount > 0 ? 100 : 0);
    console.log(`Tendencia Usuarios: ${userTrend.toFixed(2)}%`);

    // Tendencias para productos
    const [lastMonthProducts] = await db
      .select({ count: count() })
      .from(products)
      .where(
        and(
          gte(products.created_at, lastMonthStart),
          lte(products.created_at, lastMonthEnd),
          gte(products.stock, 1)
        )
      );

    const [currentMonthProducts] = await db
      .select({ count: count() })
      .from(products)
      .where(
        and(
          gte(products.created_at, currentMonthStart),
          gte(products.stock, 1)
        )
      );

    const lastMonthProductCount = lastMonthProducts.count;
    const currentMonthProductCount = currentMonthProducts.count;
    const productTrend = lastMonthProductCount > 0 ? ((currentMonthProductCount - lastMonthProductCount) / lastMonthProductCount) * 100 : (currentMonthProductCount > 0 ? 100 : 0);
    console.log(`Tendencia Productos: ${productTrend.toFixed(2)}%`);

    // Tendencias para pedidos
    const [lastMonthOrders] = await db
      .select({ count: count() })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, lastMonthStart),
          lte(orders.createdAt, lastMonthEnd)
        )
      );

    const [currentMonthOrders] = await db
      .select({ count: count() })
      .from(orders)
      .where(gte(orders.createdAt, currentMonthStart));

    const lastMonthOrderCount = lastMonthOrders.count;
    const currentMonthOrderCount = currentMonthOrders.count;
    const orderTrend = lastMonthOrderCount > 0 ? ((currentMonthOrderCount - lastMonthOrderCount) / lastMonthOrderCount) * 100 : (currentMonthOrderCount > 0 ? 100 : 0);
    console.log(`Tendencia Pedidos: ${orderTrend.toFixed(2)}%`);

    // Tendencias para ingresos
    const [lastMonthRevenue] = await db
      .select({ total: sum(orders.total) })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'paid'),
          gte(orders.createdAt, lastMonthStart),
          lte(orders.createdAt, lastMonthEnd)
        )
      );

    const [currentMonthRevenue] = await db
      .select({ total: sum(orders.total) })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'paid'),
          gte(orders.createdAt, currentMonthStart)
        )
      );

    const lastMonthRevenueTotal = Number(lastMonthRevenue?.total ?? 0);
    const currentMonthRevenueTotal = Number(currentMonthRevenue?.total ?? 0);
    const revenueTrend = lastMonthRevenueTotal > 0 ? ((currentMonthRevenueTotal - lastMonthRevenueTotal) / lastMonthRevenueTotal) * 100 : (currentMonthRevenueTotal > 0 ? 100 : 0);
    console.log(`Tendencia Ingresos: ${revenueTrend.toFixed(2)}%`);

    console.log('\nComparación con dashboard:');
    console.log('Dashboard: Usuarios 14 - 75%, Productos 13 - 80%, Pedidos 164 - 1061.54%, Ingresos $106,134.42 - 1136.87%');

  } catch (error) {
    console.error('Error al verificar estadísticas:', error);
  } finally {
    process.exit(0);
  }
}

verifyStats();
