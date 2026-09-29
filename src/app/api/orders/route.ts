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

export async function GET() {
  const orders = db.prepare("SELECT * FROM orders ORDER BY order_id DESC LIMIT 20").all()
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
