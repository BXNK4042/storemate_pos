import Database from "better-sqlite3"

const db = new Database("backend/app.db")

interface CartItem {
  item_id: number
  quantity: number
}

export async function POST(req: Request) {
  const { items, totalPrice } = (await req.json()) as { items: CartItem[]; totalPrice: number }

  if (!items || items.length === 0) {
    return Response.json({ error: "Cart is empty" }, { status: 400 })
  }

  const placeOrder = db.transaction(() => {
    const nextOrder = db
      .prepare("SELECT COALESCE(MAX(order_id), 0) + 1 AS next_id FROM orders")
      .get() as { next_id: number }
    const orderId = nextOrder.next_id

    const orderStmt = db.prepare("INSERT INTO orders (order_id, order_name, order_price) VALUES (?, ?, ?)")
    orderStmt.run(orderId, `Order #${orderId}`, totalPrice)

    const itemStmt = db.prepare("INSERT INTO order_items (order_id, item_id, quantity) VALUES (?, ?, ?)")
    const stockStmt = db.prepare("UPDATE items SET item_amount = MAX(0, item_amount - ?) WHERE item_id = ?")

    for (const item of items) {
      itemStmt.run(orderId, item.item_id, item.quantity)
      stockStmt.run(item.quantity, item.item_id)
    }

    return orderId
  })

  try {
    const orderId = placeOrder()
    return Response.json({ success: true, order_id: orderId, nextOrderId: orderId + 1 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to place order"
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100)

  const orders = db.prepare("SELECT * FROM orders ORDER BY order_id DESC LIMIT ?").all(limit) as Array<{
    order_id: number
    order_name: string
    order_price: number
    created_at?: string
    items?: Array<{
      item_id: number
      quantity: number
      item_name: string
      item_price: number
      item_images?: string | null
      item_barcode?: string
    }>
  }>

  const orderItemStmt = db.prepare(`
    SELECT oi.item_id, oi.quantity, COALESCE(i.item_name, 'Unknown Item') as item_name, COALESCE(i.item_price, 0) as item_price, i.item_images, i.item_barcode
    FROM order_items oi
    LEFT JOIN items i ON oi.item_id = i.item_id
    WHERE oi.order_id = ?
  `)

  for (const order of orders) {
    order.items = orderItemStmt.all(order.order_id) as Array<{
      item_id: number
      quantity: number
      item_name: string
      item_price: number
      item_images?: string | null
      item_barcode?: string
    }>
  }

  const salesRow = db
    .prepare("SELECT COALESCE(SUM(order_price), 0) AS total_sales FROM orders")
    .get() as { total_sales: number }
  const nextOrder = db
    .prepare("SELECT COALESCE(MAX(order_id), 0) + 1 AS next_id FROM orders")
    .get() as { next_id: number }

  return Response.json({
    orders,
    nextOrderId: nextOrder.next_id,
    totalSales: salesRow.total_sales,
    // ponytail: estimated 30% margin until item cost column is added
    totalProfit: Math.round(salesRow.total_sales * 0.3),
  })
}
