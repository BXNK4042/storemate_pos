import getDb from "./db";
import type Database from "better-sqlite3";

export interface CreateOrderItemInput {
  item_id: number;
  item_name: string;
  item_price: number;
  quantity: number;
}

export interface CreateOrderOptions {
  payment_method?: string;
  amount_paid?: number;
  change_amount?: number;
}

export interface OrderRecord {
  order_id: number;
  order_name: string;
  order_price: number;
  payment_method?: string;
  amount_paid?: number;
  change_amount?: number;
  created_at: string;
  total_quantity: number;
}

export interface OrderItemDetail {
  item_id: number;
  item_name: string;
  item_price: number;
  item_barcode: string;
  quantity: number;
  subtotal: number;
}

export interface OrderDetail extends OrderRecord {
  items: OrderItemDetail[];
}

function ensureOrderColumns(db: Database.Database) {
  const cols = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("payment_method")) {
    db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash'");
  }
  if (!names.has("amount_paid")) {
    db.exec("ALTER TABLE orders ADD COLUMN amount_paid INTEGER DEFAULT 0");
  }
  if (!names.has("change_amount")) {
    db.exec("ALTER TABLE orders ADD COLUMN change_amount INTEGER DEFAULT 0");
  }
}

export function createOrder(
  items: CreateOrderItemInput[],
  options: CreateOrderOptions = {}
) {
  const db = getDb();
  ensureOrderColumns(db);

  const totalPrice = items.reduce(
    (sum, item) => sum + item.item_price * item.quantity,
    0
  );
  const paymentMethod = options.payment_method || "cash";
  const amountPaid = options.amount_paid ?? totalPrice;
  const changeAmount = options.change_amount ?? Math.max(0, amountPaid - totalPrice);
  const orderName = `POS-${Date.now().toString().slice(-6)}`;

  const tx = db.transaction(() => {
    // 1. Verify stock availability first
    for (const item of items) {
      const stockRow = db
        .prepare("SELECT item_name, item_amount FROM items WHERE item_id = ?")
        .get(item.item_id) as { item_name: string; item_amount: number } | undefined;

      if (!stockRow) {
        throw new Error(`ไม่พบสินค้ารหัส ${item.item_id}`);
      }

      if (stockRow.item_amount < item.quantity) {
        throw new Error(
          `สินค้า "${stockRow.item_name}" สต็อกไม่พอ (คงเหลือ ${stockRow.item_amount} ชิ้น, ต้องการ ${item.quantity} ชิ้น)`
        );
      }
    }

    // 2. Insert order
    const orderStmt = db.prepare(`
      INSERT INTO orders (order_name, order_price, payment_method, amount_paid, change_amount)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = orderStmt.run(
      orderName,
      totalPrice,
      paymentMethod,
      amountPaid,
      changeAmount
    );
    const orderId = Number(result.lastInsertRowid);

    // 3. Insert order items & decrement stock
    const itemStmt = db.prepare(
      "INSERT INTO order_items (order_id, item_id, quantity) VALUES (?, ?, ?)"
    );
    const updateStockStmt = db.prepare(
      "UPDATE items SET item_amount = item_amount - ? WHERE item_id = ?"
    );

    for (const item of items) {
      itemStmt.run(orderId, item.item_id, item.quantity);
      updateStockStmt.run(item.quantity, item.item_id);
    }

    return {
      order_id: orderId,
      order_name: orderName,
      order_price: totalPrice,
      payment_method: paymentMethod,
      amount_paid: amountPaid,
      change_amount: changeAmount,
      total_items: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  });

  return tx();
}

export function getOrders(limit = 50, offset = 0): { orders: OrderRecord[]; total: number } {
  const db = getDb();
  ensureOrderColumns(db);

  const countRow = db
    .prepare("SELECT COUNT(*) as count FROM orders")
    .get() as { count: number };

  const orders = db
    .prepare(`
      SELECT 
        o.order_id,
        o.order_name,
        o.order_price,
        o.payment_method,
        o.amount_paid,
        o.change_amount,
        o.created_at,
        COALESCE(SUM(oi.quantity), 0) AS total_quantity
      FROM orders o
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      GROUP BY o.order_id
      ORDER BY o.order_id DESC
      LIMIT ? OFFSET ?
    `)
    .all(limit, offset) as OrderRecord[];

  return {
    orders,
    total: countRow.count,
  };
}

export function getOrderById(orderId: number): OrderDetail | null {
  const db = getDb();
  ensureOrderColumns(db);

  const order = db
    .prepare(`
      SELECT 
        o.order_id,
        o.order_name,
        o.order_price,
        o.payment_method,
        o.amount_paid,
        o.change_amount,
        o.created_at,
        COALESCE(SUM(oi.quantity), 0) AS total_quantity
      FROM orders o
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      WHERE o.order_id = ?
      GROUP BY o.order_id
    `)
    .get(orderId) as OrderRecord | undefined;

  if (!order) return null;

  const items = db
    .prepare(`
      SELECT 
        i.item_id,
        i.item_name,
        i.item_price,
        i.item_barcode,
        oi.quantity,
        (i.item_price * oi.quantity) AS subtotal
      FROM order_items oi
      JOIN items i ON oi.item_id = i.item_id
      WHERE oi.order_id = ?
      ORDER BY oi.item_id ASC
    `)
    .all(orderId) as OrderItemDetail[];

  return {
    ...order,
    items,
  };
}
