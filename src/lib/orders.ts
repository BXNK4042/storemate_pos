import getDb from "./db";
import type Database from "better-sqlite3";
import { recordStockAdjustmentEntry } from "./stock";

export interface CreateOrderItemInput {
  item_id: number;
  item_name: string;
  item_price: number;
  quantity: number;
  discount_type?: "percentage" | "fixed" | "none" | null;
  discount_value?: number;
}

export interface CreateOrderOptions {
  payment_method?: string;
  amount_paid?: number;
  change_amount?: number;
  discount_type?: "percentage" | "fixed" | "none" | null;
  discount_value?: number;
  promptpay_type?: "dynamic" | "static" | null;
  promptpay_ref?: string | null;
  promptpay_payload?: string | null;
  user_id?: number | null;
  user_name?: string | null;
}

export interface OrderRecord {
  order_id: number;
  order_name: string;
  order_price: number;
  subtotal?: number;
  discount_type?: string | null;
  discount_value?: number;
  discount_amount?: number;
  payment_method?: string;
  amount_paid?: number;
  change_amount?: number;
  promptpay_type?: "dynamic" | "static" | null;
  promptpay_ref?: string | null;
  promptpay_payload?: string | null;
  status: string;
  refund_reason?: string | null;
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
  discount_type?: string | null;
  discount_value?: number;
  discount_amount?: number;
  final_price: number;
}

export interface OrderDetail extends OrderRecord {
  items: OrderItemDetail[];
}

export class OrderNotFoundError extends Error {
  code = "ORDER_NOT_FOUND";
  constructor(message = "ไม่พบคำสั่งซื้อ") {
    super(message);
    this.name = "OrderNotFoundError";
  }
}

export class OrderAlreadyRefundedError extends Error {
  code = "ALREADY_REFUNDED";
  constructor(message = "คำสั่งซื้อนี้ถูกยกเลิกหรือคืนเงินไปแล้ว") {
    super(message);
    this.name = "OrderAlreadyRefundedError";
  }
}

export class InsufficientCashError extends Error {
  code = "INSUFFICIENT_CASH";
  constructor(message = "จำนวนเงินสดที่รับมาไม่เพียงพอกับยอดชำระ") {
    super(message);
    this.name = "InsufficientCashError";
  }
}

export class InvalidCashAmountError extends Error {
  code = "INVALID_CASH_AMOUNT";
  constructor(message = "จำนวนเงินสดที่ระบุไม่ถูกต้อง (ต้องอยู่ระหว่าง 0 ถึง 10,000,000 บาท)") {
    super(message);
    this.name = "InvalidCashAmountError";
  }
}

export function ensureOrderColumns(db: Database.Database) {
  // Check orders table
  const orderCols = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
  const orderNames = new Set(orderCols.map((c) => c.name));
  if (!orderNames.has("payment_method")) {
    db.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash'");
  }
  if (!orderNames.has("amount_paid")) {
    db.exec("ALTER TABLE orders ADD COLUMN amount_paid REAL DEFAULT 0");
  }
  if (!orderNames.has("change_amount")) {
    db.exec("ALTER TABLE orders ADD COLUMN change_amount REAL DEFAULT 0");
  }
  if (!orderNames.has("status")) {
    db.exec("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'completed'");
  }
  if (!orderNames.has("refund_reason")) {
    db.exec("ALTER TABLE orders ADD COLUMN refund_reason TEXT");
  }
  if (!orderNames.has("subtotal")) {
    db.exec("ALTER TABLE orders ADD COLUMN subtotal REAL DEFAULT 0");
  }
  if (!orderNames.has("discount_type")) {
    db.exec("ALTER TABLE orders ADD COLUMN discount_type TEXT");
  }
  if (!orderNames.has("discount_value")) {
    db.exec("ALTER TABLE orders ADD COLUMN discount_value REAL DEFAULT 0");
  }
  if (!orderNames.has("discount_amount")) {
    db.exec("ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0");
  }
  if (!orderNames.has("promptpay_type")) {
    db.exec("ALTER TABLE orders ADD COLUMN promptpay_type TEXT");
  }
  if (!orderNames.has("promptpay_ref")) {
    db.exec("ALTER TABLE orders ADD COLUMN promptpay_ref TEXT");
  }
  if (!orderNames.has("promptpay_payload")) {
    db.exec("ALTER TABLE orders ADD COLUMN promptpay_payload TEXT");
  }

  // Check order_items table
  const itemCols = db.prepare("PRAGMA table_info(order_items)").all() as { name: string }[];
  const itemNames = new Set(itemCols.map((c) => c.name));
  if (!itemNames.has("discount_type")) {
    db.exec("ALTER TABLE order_items ADD COLUMN discount_type TEXT");
  }
  if (!itemNames.has("discount_value")) {
    db.exec("ALTER TABLE order_items ADD COLUMN discount_value REAL DEFAULT 0");
  }
  if (!itemNames.has("discount_amount")) {
    db.exec("ALTER TABLE order_items ADD COLUMN discount_amount REAL DEFAULT 0");
  }
  if (!itemNames.has("final_price")) {
    db.exec("ALTER TABLE order_items ADD COLUMN final_price REAL DEFAULT 0");
  }
}

export function createOrder(
  items: CreateOrderItemInput[],
  options: CreateOrderOptions = {}
) {
  const db = getDb();
  ensureOrderColumns(db);

  // 1. Calculate item-level discounts and subtotal
  const processedItems = items.map((item) => {
    const rawSubtotal = item.item_price * item.quantity;
    let discountAmount = 0;
    const discountType = item.discount_type || null;
    const discountValue = Number(item.discount_value) || 0;

    if (discountType === "percentage") {
      discountAmount = Math.min(rawSubtotal, (rawSubtotal * discountValue) / 100);
    } else if (discountType === "fixed") {
      discountAmount = Math.min(rawSubtotal, discountValue);
    }
    discountAmount = Math.max(0, Math.round(discountAmount * 100) / 100);
    const finalPrice = Math.max(0, rawSubtotal - discountAmount);

    return {
      ...item,
      raw_subtotal: rawSubtotal,
      discount_type: discountType,
      discount_value: discountValue,
      discount_amount: discountAmount,
      final_price: finalPrice,
    };
  });

  // Order subtotal = sum of all items' final_price after item-level discounts
  const orderSubtotal = processedItems.reduce((sum, item) => sum + item.final_price, 0);

  // 2. Calculate order-level discount
  let orderDiscountAmount = 0;
  const orderDiscountType = options.discount_type || null;
  const orderDiscountValue = Number(options.discount_value) || 0;

  if (orderDiscountType === "percentage") {
    orderDiscountAmount = Math.min(orderSubtotal, (orderSubtotal * orderDiscountValue) / 100);
  } else if (orderDiscountType === "fixed") {
    orderDiscountAmount = Math.min(orderSubtotal, orderDiscountValue);
  }
  orderDiscountAmount = Math.max(0, Math.round(orderDiscountAmount * 100) / 100);

  const finalTotalPrice = Math.max(0, Math.round((orderSubtotal - orderDiscountAmount) * 100) / 100);

  const paymentMethod = options.payment_method || "cash";
  let amountPaid = options.amount_paid ?? finalTotalPrice;
  let changeAmount = 0;

  if (paymentMethod === "cash") {
    if (typeof amountPaid !== "number" || isNaN(amountPaid) || amountPaid < 0 || amountPaid > 10_000_000) {
      throw new InvalidCashAmountError("จำนวนเงินสดที่ระบุไม่ถูกต้อง (ต้องอยู่ระหว่าง 0 ถึง 10,000,000 บาท)");
    }

    const paidSatang = Math.round(amountPaid * 100);
    const finalSatang = Math.round(finalTotalPrice * 100);

    if (paidSatang < finalSatang) {
      const shortfall = (finalSatang - paidSatang) / 100;
      throw new InsufficientCashError(
        `จำนวนเงินสดที่รับมา (฿${amountPaid.toLocaleString()}) ไม่เพียงพอกับยอดชำระ (฿${finalTotalPrice.toLocaleString()}) ขาดอีก ฿${shortfall.toLocaleString()}`
      );
    }

    // Server-verified change calculation
    changeAmount = Math.max(0, Math.round(paidSatang - finalSatang) / 100);
    amountPaid = Math.round(paidSatang) / 100;
  } else {
    amountPaid = finalTotalPrice;
    changeAmount = 0;
  }

  const promptpayType = options.promptpay_type ?? null;
  const promptpayRef = options.promptpay_ref ?? null;
  const promptpayPayload = options.promptpay_payload ?? null;
  const orderName = `POS-${Date.now().toString().slice(-6)}`;

  const tx = db.transaction(() => {
    // 1. Verify stock availability first
    const stockMap = new Map<number, number>();
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
      stockMap.set(item.item_id, stockRow.item_amount);
    }

    // 2. Insert order
    const orderStmt = db.prepare(`
      INSERT INTO orders (
        order_name, order_price, subtotal, discount_type, discount_value, discount_amount,
        payment_method, amount_paid, change_amount, promptpay_type, promptpay_ref, promptpay_payload, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    `);
    const result = orderStmt.run(
      orderName,
      finalTotalPrice,
      orderSubtotal,
      orderDiscountType,
      orderDiscountValue,
      orderDiscountAmount,
      paymentMethod,
      amountPaid,
      changeAmount,
      promptpayType,
      promptpayRef,
      promptpayPayload
    );
    const orderId = Number(result.lastInsertRowid);

    // 3. Insert order items & decrement stock & record audit logs
    const itemStmt = db.prepare(`
      INSERT INTO order_items (
        order_id, item_id, quantity, discount_type, discount_value, discount_amount, final_price
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const updateStockStmt = db.prepare(
      "UPDATE items SET item_amount = item_amount - ? WHERE item_id = ?"
    );

    for (const item of processedItems) {
      itemStmt.run(
        orderId,
        item.item_id,
        item.quantity,
        item.discount_type,
        item.discount_value,
        item.discount_amount,
        item.final_price
      );

      const currentStock = stockMap.get(item.item_id) ?? 0;
      const newStock = currentStock - item.quantity;
      updateStockStmt.run(item.quantity, item.item_id);
      stockMap.set(item.item_id, newStock);

      recordStockAdjustmentEntry(db, {
        item_id: item.item_id,
        change_qty: -item.quantity,
        previous_qty: currentStock,
        new_qty: newStock,
        reason: "sale",
        reference_id: `ORDER-${orderId}`,
        note: `ขายสินค้าผ่าน POS (บิล ${orderName})`,
        user_id: options.user_id || null,
        user_name: options.user_name || null,
      });
    }

    return {
      order_id: orderId,
      order_name: orderName,
      order_price: finalTotalPrice,
      subtotal: orderSubtotal,
      discount_type: orderDiscountType,
      discount_value: orderDiscountValue,
      discount_amount: orderDiscountAmount,
      payment_method: paymentMethod,
      amount_paid: amountPaid,
      change_amount: changeAmount,
      promptpay_type: promptpayType,
      promptpay_ref: promptpayRef,
      promptpay_payload: promptpayPayload,
      status: "completed",
      total_items: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  });

  return tx();
}

export function refundOrder(
  orderId: number,
  reason?: string,
  user?: { user_id?: number | null; user_name?: string | null }
) {
  const db = getDb();
  ensureOrderColumns(db);

  const tx = db.transaction(() => {
    // 1. Check order exists and status is not already 'refunded'
    const order = db
      .prepare("SELECT order_id, COALESCE(status, 'completed') AS status FROM orders WHERE order_id = ?")
      .get(orderId) as { order_id: number; status: string } | undefined;

    if (!order) {
      throw new OrderNotFoundError("ไม่พบคำสั่งซื้อ");
    }

    if (order.status === "refunded") {
      throw new OrderAlreadyRefundedError("คำสั่งซื้อนี้ถูกยกเลิกหรือคืนเงินไปแล้ว");
    }

    // 2. Update orders set status = 'refunded', refund_reason = ? where order_id = ?
    const refundReason = reason?.trim() || null;
    db.prepare("UPDATE orders SET status = 'refunded', refund_reason = ? WHERE order_id = ?")
      .run(refundReason, orderId);

    // 3. Restore items inventory: for each item in order_items for that order, update items set item_amount = item_amount + quantity
    const orderItems = db
      .prepare("SELECT item_id, quantity FROM order_items WHERE order_id = ?")
      .all(orderId) as { item_id: number; quantity: number }[];

    const restoreStockStmt = db.prepare(
      "UPDATE items SET item_amount = item_amount + ? WHERE item_id = ?"
    );

    for (const item of orderItems) {
      const currentItem = db
        .prepare("SELECT item_amount FROM items WHERE item_id = ?")
        .get(item.item_id) as { item_amount: number } | undefined;
      const prevQty = currentItem ? currentItem.item_amount : 0;
      const newQty = prevQty + item.quantity;

      restoreStockStmt.run(item.quantity, item.item_id);

      recordStockAdjustmentEntry(db, {
        item_id: item.item_id,
        change_qty: item.quantity,
        previous_qty: prevQty,
        new_qty: newQty,
        reason: "refund",
        reference_id: `REFUND-${orderId}`,
        note: refundReason ? `คืนเงินคำสั่งซื้อ: ${refundReason}` : "คืนเงินคำสั่งซื้อ",
        user_id: user?.user_id || null,
        user_name: user?.user_name || null,
      });
    }

    return {
      order_id: orderId,
      status: "refunded",
      refund_reason: refundReason,
      restored_items_count: orderItems.length,
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
        COALESCE(o.subtotal, o.order_price) AS subtotal,
        o.discount_type,
        COALESCE(o.discount_value, 0) AS discount_value,
        COALESCE(o.discount_amount, 0) AS discount_amount,
        o.payment_method,
        o.amount_paid,
        o.change_amount,
        o.promptpay_type,
        o.promptpay_ref,
        o.promptpay_payload,
        COALESCE(o.status, 'completed') AS status,
        o.refund_reason,
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
        COALESCE(o.subtotal, o.order_price) AS subtotal,
        o.discount_type,
        COALESCE(o.discount_value, 0) AS discount_value,
        COALESCE(o.discount_amount, 0) AS discount_amount,
        o.payment_method,
        o.amount_paid,
        o.change_amount,
        o.promptpay_type,
        o.promptpay_ref,
        o.promptpay_payload,
        COALESCE(o.status, 'completed') AS status,
        o.refund_reason,
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
        (i.item_price * oi.quantity) AS subtotal,
        oi.discount_type,
        COALESCE(oi.discount_value, 0) AS discount_value,
        COALESCE(oi.discount_amount, 0) AS discount_amount,
        COALESCE(oi.final_price, (i.item_price * oi.quantity)) AS final_price
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
