import getDb from "./db";
import type Database from "better-sqlite3";
import type {
  CreateStockAdjustmentInput,
  StockAdjustmentRecord,
  StockAdjustmentFilterParams,
  StockAdjustmentListResult,
  StockAdjustmentReason,
} from "@/types/stock";

export class StockError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "StockError";
  }
}

export const VALID_STOCK_REASONS: StockAdjustmentReason[] = [
  "restock",
  "damage",
  "expired",
  "inventory_count",
  "loss",
  "correction",
  "sale",
  "refund",
  "initial",
  "other",
];

export function ensureStockAdjustmentTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      adjustment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      change_qty INTEGER NOT NULL,
      previous_qty INTEGER NOT NULL,
      new_qty INTEGER NOT NULL,
      reason TEXT NOT NULL,
      reference_id TEXT,
      note TEXT,
      user_id INTEGER,
      user_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stock_adjustments_item_id 
      ON stock_adjustments(item_id);

    CREATE INDEX IF NOT EXISTS idx_stock_adjustments_created_at 
      ON stock_adjustments(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_stock_adjustments_reason 
      ON stock_adjustments(reason);
  `);
}

/**
 * Executes an atomic stock adjustment and creates an immutable audit record.
 */
export function adjustItemStock(
  input: CreateStockAdjustmentInput,
  externalDb?: Database.Database
): { adjustment: StockAdjustmentRecord; currentAmount: number } {
  const db = externalDb || getDb();
  ensureStockAdjustmentTable(db);

  if (!VALID_STOCK_REASONS.includes(input.reason)) {
    throw new StockError(`เหตุผลการปรับสต็อกไม่ถูกต้อง: ${input.reason}`, "INVALID_REASON");
  }

  const execute = () => {
    // 1. Lock and fetch current item state
    const item = db
      .prepare("SELECT item_id, item_name, item_amount, item_barcode FROM items WHERE item_id = ?")
      .get(input.item_id) as
      | { item_id: number; item_name: string; item_amount: number; item_barcode: string }
      | undefined;

    if (!item) {
      throw new StockError(`ไม่พบสินค้ารหัส #${input.item_id}`, "ITEM_NOT_FOUND");
    }

    const prevQty = item.item_amount;
    let changeQty = 0;
    let newQty = 0;

    if (input.mode === "add") {
      if (typeof input.quantity !== "number" || isNaN(input.quantity) || input.quantity <= 0) {
        throw new StockError("จำนวนต้องมากกว่า 0", "INVALID_QUANTITY");
      }
      changeQty = Math.floor(input.quantity);
      newQty = prevQty + changeQty;
    } else if (input.mode === "remove") {
      if (typeof input.quantity !== "number" || isNaN(input.quantity) || input.quantity <= 0) {
        throw new StockError("จำนวนต้องมากกว่า 0", "INVALID_QUANTITY");
      }
      const qtyToRemove = Math.floor(input.quantity);
      if (prevQty - qtyToRemove < 0) {
        throw new StockError(
          `สต็อกไม่เพียงพอสำหรับการตัดออก (คงเหลือ ${prevQty} ชิ้น, ต้องการตัดออก ${qtyToRemove} ชิ้น)`,
          "INSUFFICIENT_STOCK"
        );
      }
      changeQty = -qtyToRemove;
      newQty = prevQty + changeQty;
    } else if (input.mode === "set") {
      if (typeof input.quantity !== "number" || isNaN(input.quantity) || input.quantity < 0) {
        throw new StockError("จำนวนสต็อกต้องไม่ติดลบ", "INVALID_QUANTITY");
      }
      newQty = Math.floor(input.quantity);
      changeQty = newQty - prevQty;
    } else {
      throw new StockError("โหมดการปรับสต็อกไม่ถูกต้อง", "INVALID_MODE");
    }

    // 2. Update items table
    db.prepare("UPDATE items SET item_amount = ? WHERE item_id = ?").run(newQty, input.item_id);

    // 3. Insert audit log record
    const insertStmt = db.prepare(`
      INSERT INTO stock_adjustments (
        item_id, change_qty, previous_qty, new_qty, reason, reference_id, note, user_id, user_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      input.item_id,
      changeQty,
      prevQty,
      newQty,
      input.reason,
      input.reference_id || null,
      input.note ? input.note.trim() : null,
      input.user_id || null,
      input.user_name || null
    );

    const insertedId = Number(result.lastInsertRowid);
    const row = db
      .prepare("SELECT created_at FROM stock_adjustments WHERE adjustment_id = ?")
      .get(insertedId) as { created_at: string } | undefined;

    const record: StockAdjustmentRecord = {
      adjustment_id: insertedId,
      item_id: input.item_id,
      item_name: item.item_name,
      item_barcode: item.item_barcode,
      change_qty: changeQty,
      previous_qty: prevQty,
      new_qty: newQty,
      reason: input.reason,
      reference_id: input.reference_id || null,
      note: input.note ? input.note.trim() : null,
      user_id: input.user_id || null,
      user_name: input.user_name || null,
      created_at: row?.created_at || new Date().toISOString(),
    };

    return { adjustment: record, currentAmount: newQty };
  };

  if (externalDb) {
    return execute();
  } else {
    return db.transaction(execute)();
  }
}

/**
 * Directly records an audit entry inside an already existing transaction.
 */
export function recordStockAdjustmentEntry(
  db: Database.Database,
  data: {
    item_id: number;
    change_qty: number;
    previous_qty: number;
    new_qty: number;
    reason: StockAdjustmentReason;
    reference_id?: string | null;
    note?: string | null;
    user_id?: number | null;
    user_name?: string | null;
  }
): StockAdjustmentRecord {
  ensureStockAdjustmentTable(db);

  const insertStmt = db.prepare(`
    INSERT INTO stock_adjustments (
      item_id, change_qty, previous_qty, new_qty, reason, reference_id, note, user_id, user_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insertStmt.run(
    data.item_id,
    data.change_qty,
    data.previous_qty,
    data.new_qty,
    data.reason,
    data.reference_id || null,
    data.note ? data.note.trim() : null,
    data.user_id || null,
    data.user_name || null
  );

  const insertedId = Number(result.lastInsertRowid);
  const row = db
    .prepare("SELECT created_at FROM stock_adjustments WHERE adjustment_id = ?")
    .get(insertedId) as { created_at: string } | undefined;

  return {
    adjustment_id: insertedId,
    item_id: data.item_id,
    change_qty: data.change_qty,
    previous_qty: data.previous_qty,
    new_qty: data.new_qty,
    reason: data.reason,
    reference_id: data.reference_id || null,
    note: data.note ? data.note.trim() : null,
    user_id: data.user_id || null,
    user_name: data.user_name || null,
    created_at: row?.created_at || new Date().toISOString(),
  };
}

/**
 * Retrieves paginated audit logs with filtering and summary metrics.
 */
export function getStockAdjustments(
  params: StockAdjustmentFilterParams = {},
  externalDb?: Database.Database
): StockAdjustmentListResult {
  const db = externalDb || getDb();
  ensureStockAdjustmentTable(db);

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  const whereConditions: string[] = [];
  const queryParams: (string | number)[] = [];

  if (params.item_id !== undefined && params.item_id !== null && !isNaN(params.item_id)) {
    whereConditions.push("sa.item_id = ?");
    queryParams.push(params.item_id);
  }

  if (params.reason && params.reason !== "all") {
    whereConditions.push("sa.reason = ?");
    queryParams.push(params.reason);
  }

  if (params.startDate) {
    whereConditions.push("DATE(sa.created_at) >= DATE(?)");
    queryParams.push(params.startDate);
  }

  if (params.endDate) {
    whereConditions.push("DATE(sa.created_at) <= DATE(?)");
    queryParams.push(params.endDate);
  }

  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    whereConditions.push(
      "(i.item_name LIKE ? OR i.item_barcode LIKE ? OR sa.note LIKE ? OR sa.reference_id LIKE ?)"
    );
    queryParams.push(term, term, term, term);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  // 1. Get total count and aggregate metrics
  const metricsSql = `
    SELECT 
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN sa.change_qty > 0 THEN sa.change_qty ELSE 0 END), 0) AS total_in,
      COALESCE(SUM(CASE WHEN sa.change_qty < 0 THEN ABS(sa.change_qty) ELSE 0 END), 0) AS total_out,
      COALESCE(SUM(sa.change_qty), 0) AS net_change
    FROM stock_adjustments sa
    LEFT JOIN items i ON sa.item_id = i.item_id
    ${whereClause}
  `;

  const metricsRow = db.prepare(metricsSql).get(...queryParams) as {
    total: number;
    total_in: number;
    total_out: number;
    net_change: number;
  };

  const total = metricsRow?.total || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  // 2. Query paginated records
  const listSql = `
    SELECT 
      sa.adjustment_id,
      sa.item_id,
      i.item_name,
      i.item_barcode,
      sa.change_qty,
      sa.previous_qty,
      sa.new_qty,
      sa.reason,
      sa.reference_id,
      sa.note,
      sa.user_id,
      sa.user_name,
      sa.created_at
    FROM stock_adjustments sa
    LEFT JOIN items i ON sa.item_id = i.item_id
    ${whereClause}
    ORDER BY sa.adjustment_id DESC
    LIMIT ? OFFSET ?
  `;

  const adjustments = db
    .prepare(listSql)
    .all(...queryParams, limit, offset) as StockAdjustmentRecord[];

  return {
    adjustments,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
    metrics: {
      totalIn: metricsRow?.total_in || 0,
      totalOut: metricsRow?.total_out || 0,
      netChange: metricsRow?.net_change || 0,
      recordCount: total,
    },
  };
}

/**
 * Retrieves recent stock movement history for a specific item.
 */
export function getItemStockHistory(
  itemId: number,
  limit = 20,
  externalDb?: Database.Database
): StockAdjustmentRecord[] {
  const db = externalDb || getDb();
  ensureStockAdjustmentTable(db);

  const safeLimit = Math.min(100, Math.max(1, limit));

  const listSql = `
    SELECT 
      sa.adjustment_id,
      sa.item_id,
      i.item_name,
      i.item_barcode,
      sa.change_qty,
      sa.previous_qty,
      sa.new_qty,
      sa.reason,
      sa.reference_id,
      sa.note,
      sa.user_id,
      sa.user_name,
      sa.created_at
    FROM stock_adjustments sa
    LEFT JOIN items i ON sa.item_id = i.item_id
    WHERE sa.item_id = ?
    ORDER BY sa.adjustment_id DESC
    LIMIT ?
  `;

  return db.prepare(listSql).all(itemId, safeLimit) as StockAdjustmentRecord[];
}
