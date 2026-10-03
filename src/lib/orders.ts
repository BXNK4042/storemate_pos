import getDb from "./db";

export interface CreateOrderItemInput {
  item_id: number;
  item_name: string;
  item_price: number;
  quantity: number;
}

export function createOrder(items: CreateOrderItemInput[]) {
  const db = getDb();
  const totalPrice = items.reduce(
    (sum, item) => sum + item.item_price * item.quantity,
    0
  );
  const orderName = `POS-${Date.now().toString().slice(-6)}`;

  const tx = db.transaction(() => {
    const orderStmt = db.prepare(
      "INSERT INTO orders (order_name, order_price) VALUES (?, ?)"
    );
    const result = orderStmt.run(orderName, totalPrice);
    const orderId = result.lastInsertRowid;

    const itemStmt = db.prepare(
      "INSERT INTO order_items (order_id, item_id, quantity) VALUES (?, ?, ?)"
    );
    const updateStockStmt = db.prepare(
      "UPDATE items SET item_amount = MAX(0, item_amount - ?) WHERE item_id = ?"
    );

    for (const item of items) {
      itemStmt.run(orderId, item.item_id, item.quantity);
      updateStockStmt.run(item.quantity, item.item_id);
    }

    return {
      order_id: Number(orderId),
      order_name: orderName,
      order_price: totalPrice,
      total_items: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  });

  return tx();
}
