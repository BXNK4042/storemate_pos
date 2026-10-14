import getDb from "./db";
import { ensureOrderColumns } from "./orders";
import { getLowStockSummary } from "./stock-alerts";

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  todayRevenue: number;
  todayOrders: number;
  monthRevenue: number;
  totalProducts: number;
  lowStockProducts: number;
  salesBarChart: { label: string; sales: number; orders: number }[];
  salesLineChart: { label: string; sales: number }[];
  topItemsPieChart: { name: string; value: number; fill: string }[];
}

const PIE_COLORS = [
  "var(--color-chart-1, #3b82f6)",
  "var(--color-chart-2, #10b981)",
  "var(--color-chart-3, #f59e0b)",
  "var(--color-chart-4, #ef4444)",
  "var(--color-chart-5, #8b5cf6)",
];

export function getDashboardStats(): DashboardStats {
  const db = getDb();
  ensureOrderColumns(db);

  // Total revenue & orders (excluding refunded)
  const totals = db
    .prepare(`
      SELECT 
        COALESCE(SUM(order_price), 0) AS totalRevenue,
        COUNT(order_id) AS totalOrders
      FROM orders
      WHERE COALESCE(status, 'completed') != 'refunded'
    `)
    .get() as { totalRevenue: number; totalOrders: number };

  // Today stats (SQLite date('now', 'localtime'))
  const today = db
    .prepare(`
      SELECT 
        COALESCE(SUM(order_price), 0) AS todayRevenue,
        COUNT(order_id) AS todayOrders
      FROM orders
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
        AND COALESCE(status, 'completed') != 'refunded'
    `)
    .get() as { todayRevenue: number; todayOrders: number };

  // Month stats
  const month = db
    .prepare(`
      SELECT 
        COALESCE(SUM(order_price), 0) AS monthRevenue
      FROM orders
      WHERE strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')
        AND COALESCE(status, 'completed') != 'refunded'
    `)
    .get() as { monthRevenue: number };

  // Inventory stats
  const stockSummary = getLowStockSummary(db);

  // Last 7 days sales for Bar Chart
  const last7Days = db
    .prepare(`
      WITH RECURSIVE dates(date_val) AS (
        SELECT date('now', 'localtime', '-6 days')
        UNION ALL
        SELECT date(date_val, '+1 day')
        FROM dates
        WHERE date_val < date('now', 'localtime')
      )
      SELECT 
        strftime('%d/%m', d.date_val) AS label,
        COALESCE(SUM(o.order_price), 0) AS sales,
        COUNT(o.order_id) AS orders
      FROM dates d
      LEFT JOIN orders o ON date(o.created_at, 'localtime') = d.date_val
        AND COALESCE(o.status, 'completed') != 'refunded'
      GROUP BY d.date_val
      ORDER BY d.date_val ASC
    `)
    .all() as { label: string; sales: number; orders: number }[];

  // Sales trend by hour for today (or last 24h) for Line Chart
  const hourlyTrend = db
    .prepare(`
      WITH RECURSIVE hours(h) AS (
        SELECT 10
        UNION ALL
        SELECT h + 2
        FROM hours
        WHERE h < 22
      )
      SELECT 
        printf('%02d:00', h.h) AS label,
        COALESCE(SUM(o.order_price), 0) AS sales
      FROM hours h
      LEFT JOIN orders o ON 
        date(o.created_at, 'localtime') = date('now', 'localtime')
        AND CAST(strftime('%H', o.created_at, 'localtime') AS INTEGER) >= h.h
        AND CAST(strftime('%H', o.created_at, 'localtime') AS INTEGER) < h.h + 2
        AND COALESCE(o.status, 'completed') != 'refunded'
      GROUP BY h.h
      ORDER BY h.h ASC
    `)
    .all() as { label: string; sales: number }[];

  // Top selling products for Pie Chart
  const topProducts = db
    .prepare(`
      SELECT 
        i.item_name AS name,
        COALESCE(SUM(oi.quantity), 0) AS value
      FROM order_items oi
      JOIN items i ON oi.item_id = i.item_id
      JOIN orders o ON oi.order_id = o.order_id
      WHERE COALESCE(o.status, 'completed') != 'refunded'
      GROUP BY oi.item_id
      ORDER BY value DESC
      LIMIT 5
    `)
    .all() as { name: string; value: number }[];

  const topItemsPieChart = topProducts.map((p, index) => ({
    name: p.name,
    value: Number(p.value),
    fill: PIE_COLORS[index % PIE_COLORS.length],
  }));

  return {
    totalRevenue: Number(totals.totalRevenue),
    totalOrders: Number(totals.totalOrders),
    todayRevenue: Number(today.todayRevenue),
    todayOrders: Number(today.todayOrders),
    monthRevenue: Number(month.monthRevenue),
    totalProducts: Number(stockSummary.totalProducts),
    lowStockProducts: Number(stockSummary.attentionCount),
    salesBarChart: last7Days,
    salesLineChart: hourlyTrend,
    topItemsPieChart,
  };
}
