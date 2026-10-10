import Database from "better-sqlite3"

const db = new Database("backend/app.db")

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export async function GET() {
  try {
    // 1. Top selling items
    const topProductsRaw = db.prepare(`
      SELECT 
        i.item_id,
        i.item_name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.quantity * COALESCE(i.item_price, 0)) as total_sales
      FROM order_items oi
      JOIN items i ON oi.item_id = i.item_id
      GROUP BY oi.item_id
      ORDER BY total_quantity DESC
      LIMIT 5
    `).all() as Array<{
      item_id: number
      item_name: string
      total_quantity: number
      total_sales: number
    }>

    // Fallback if no items sold yet
    const topProducts = topProductsRaw.length > 0 ? topProductsRaw : [
      { item_id: 1, item_name: "ยังไม่มีข้อมูล", total_quantity: 1, total_sales: 0 }
    ]

    // 2. Daily sales (last 7 days or by day of week)
    const dailySalesRaw = db.prepare(`
      SELECT 
        strftime('%w', created_at) as day_idx,
        DATE(created_at) as sale_date,
        SUM(order_price) as sales,
        COUNT(order_id) as orders
      FROM orders
      GROUP BY DATE(created_at)
      ORDER BY sale_date ASC
      LIMIT 7
    `).all() as Array<{
      day_idx: string
      sale_date: string
      sales: number
      orders: number
    }>

    // Map to day names
    const dailySales = dailySalesRaw.length > 0
      ? dailySalesRaw.map((d) => ({
          day: DAY_NAMES[parseInt(d.day_idx, 10)] || d.sale_date,
          date: d.sale_date,
          sale: d.sales,
          orders: d.orders,
        }))
      : DAY_NAMES.map((name) => ({ day: name, date: "", sale: 0, orders: 0 }))

    // 3. Hourly traffic
    const hourlyTrafficRaw = db.prepare(`
      SELECT 
        strftime('%H', created_at) as hour_str,
        COUNT(order_id) as customer_count,
        SUM(order_price) as hourly_sales
      FROM orders
      GROUP BY strftime('%H', created_at)
      ORDER BY hour_str ASC
    `).all() as Array<{
      hour_str: string
      customer_count: number
      hourly_sales: number
    }>

    const hourlyTraffic = hourlyTrafficRaw.length > 0
      ? hourlyTrafficRaw.map((h) => ({
          time: `${h.hour_str}:00`,
          customer: h.customer_count,
          sales: h.hourly_sales,
        }))
      : [
          { time: "08:00", customer: 0, sales: 0 },
          { time: "12:00", customer: 0, sales: 0 },
          { time: "16:00", customer: 0, sales: 0 },
          { time: "20:00", customer: 0, sales: 0 },
        ]

    // 4. Overall stats
    const statsRow = db.prepare(`
      SELECT 
        COUNT(order_id) as total_orders,
        COALESCE(SUM(order_price), 0) as total_revenue,
        COALESCE(AVG(order_price), 0) as avg_order_value
      FROM orders
    `).get() as {
      total_orders: number
      total_revenue: number
      avg_order_value: number
    }

    return Response.json({
      topProducts,
      dailySales,
      hourlyTraffic,
      totalOrders: statsRow.total_orders,
      totalRevenue: statsRow.total_revenue,
      avgOrderValue: Math.round(statsRow.avg_order_value),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Analytics query failed"
    return Response.json({ error: message }, { status: 500 })
  }
}
