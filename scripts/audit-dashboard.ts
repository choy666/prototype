#!/usr/bin/env tsx

import { db } from '../lib/db';
import { count, sum, eq, gte, and } from 'drizzle-orm';
import { users, products, orders } from '../lib/schema';

async function auditDashboard() {
  console.log('🔍 Iniciando auditoría completa del dashboard...\n');

  try {
    // Verificar total usuarios
    const [userCount] = await db.select({ count: count() }).from(users);
    console.log('👥 Total Usuarios:', userCount.count);

    // Verificar total productos
    const [productCount] = await db.select({ count: count() }).from(products);
    console.log('📦 Total Productos:', productCount.count);

    // Verificar total pedidos
    const [orderCount] = await db.select({ count: count() }).from(orders);
    console.log('🛒 Total Pedidos:', orderCount.count);

    // Verificar ingresos totales
    const [revenueResult] = await db
      .select({ total: sum(orders.total) })
      .from(orders)
      .where(eq(orders.status, 'paid'));
    const revenue = Number(revenueResult?.total ?? 0);
    console.log('💰 Ingresos Totales:', revenue.toLocaleString());

    // Calcular tendencias del último mes
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Usuarios del último mes
    const [lastMonthUsers] = await db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, lastMonth));

    // Productos del último mes
    const [lastMonthProducts] = await db
      .select({ count: count() })
      .from(products)
      .where(gte(products.created_at, lastMonth));

    // Pedidos del último mes
    const [lastMonthOrders] = await db
      .select({ count: count() })
      .from(orders)
      .where(gte(orders.createdAt, lastMonth));

    // Ingresos del último mes
    const [lastMonthRevenue] = await db
      .select({ total: sum(orders.total) })
      .from(orders)
      .where(
        and(
          eq(orders.status, 'paid'),
          gte(orders.createdAt, lastMonth)
        )
      );

    const lastMonthRevenueValue = Number(lastMonthRevenue?.total ?? 0);

    console.log('\n📊 Cálculo de tendencias:');
    console.log('Usuarios último mes:', lastMonthUsers.count);
    console.log('Productos último mes:', lastMonthProducts.count);
    console.log('Pedidos último mes:', lastMonthOrders.count);
    console.log('Ingresos último mes:', lastMonthRevenueValue.toLocaleString());

    // Calcular porcentajes
    const userTrend = lastMonthUsers.count > 0 ? ((userCount.count - lastMonthUsers.count) / lastMonthUsers.count) * 100 : 0;
    const productTrend = lastMonthProducts.count > 0 ? ((productCount.count - lastMonthProducts.count) / lastMonthProducts.count) * 100 : 0;
    const orderTrend = lastMonthOrders.count > 0 ? ((orderCount.count - lastMonthOrders.count) / lastMonthOrders.count) * 100 : 0;
    const revenueTrend = lastMonthRevenueValue > 0 ? ((revenue - lastMonthRevenueValue) / lastMonthRevenueValue) * 100 : 0;

    console.log('\n📈 Tendencias calculadas:');
    console.log('Usuarios:', userTrend.toFixed(1) + '%');
    console.log('Productos:', productTrend.toFixed(1) + '%');
    console.log('Pedidos:', orderTrend.toFixed(1) + '%');
    console.log('Ingresos:', revenueTrend.toFixed(1) + '%');

    console.log('\n✅ Auditoría completada exitosamente');

    // Retornar resultados para el reporte
    return {
      users: userCount.count,
      products: productCount.count,
      orders: orderCount.count,
      revenue,
      trends: {
        users: userTrend,
        products: productTrend,
        orders: orderTrend,
        revenue: revenueTrend
      }
    };

  } catch (error) {
    console.error('❌ Error en auditoría:', error);
    throw error;
  }
}

if (require.main === module) {
  auditDashboard().then(result => {
    console.log('\n📋 Resultados finales:', JSON.stringify(result, null, 2));
  }).catch(console.error);
}

export { auditDashboard };
