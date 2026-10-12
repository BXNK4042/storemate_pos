import getDb from "./db";
import type Database from "better-sqlite3";
import type {
  WasteReason,
  WasteRecord,
  CreateWasteInput,
  WasteFilterParams,
  WasteSummaryMetrics,
  WasteListResult,
  WasteReasonMetric,
  TopWastedItem,
} from "@/types/waste";
import type { StockAdjustmentReason } from "@/types/stock";
import { ensureStockAdjustmentTable, recordStockAdjustmentEntry } from "./stock";

export class WasteError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "WasteError";
  }
}

export const VALID_WASTE_REASONS: WasteReason[] = [
  "damaged",
  "spoiled",
  "expired",
  "discarded",
  "other",
];

export const WASTE_TO_STOCK_REASON: Record<WasteReason, StockAdjustmentReason> = {
  damaged: "damage",
  spoiled: "damage",
  expired: "expired",
  discarded: "loss",
  other: "other",
};

export function ensureWasteTable(db: Database.Database): void {
  ensureStockAdjustmentTable(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS waste_records (
      waste_id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_cost REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      reason TEXT NOT NULL CHECK (reason IN ('damaged', 'spoiled', 'expired', 'discarded', 'other')),
      notes TEXT,
      user_id INTEGER,
      user_name TEXT,
      adjustment_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
      FOREIGN KEY (adjustment_id) REFERENCES stock_adjustments(adjustment_id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_waste_records_item_id ON waste_records(item_id);
    CREATE INDEX IF NOT EXISTS idx_waste_records_created_at ON waste_records(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_waste_records_reason ON waste_records(reason);
  `);
}

/**
 * Logs a waste incident: atomically deducts stock, creates a stock adjustment audit log,
 * and records the waste details with financial loss tracking.
 */
export function logWasteItem(
  input: CreateWasteInput,
  externalDb?: Database.Database
): { waste: WasteRecord; remainingStock: number } {
  const db = externalDb || getDb();
  ensureWasteTable(db);

  if (
    typeof input.quantity !== "number" ||
    isNaN(input.quantity) ||
    input.quantity <= 0 ||
    !Number.isInteger(input.quantity)
  ) {
    throw new WasteError("จำนวนสินค้าต้องเป็นจำนวนเต็มบวกที่มากกว่า 0", "INVALID_QUANTITY");
  }

  if (!VALID_WASTE_REASONS.includes(input.reason)) {
    throw new WasteError(`เหตุผลการตัดของเสียไม่ถูกต้อง: ${input.reason}`, "INVALID_REASON");
  }

  const execute = () => {
    // 1. Fetch current item
    const item = db
      .prepare(
        "SELECT item_id, item_name, item_price, item_amount, item_barcode FROM items WHERE item_id = ?"
      )
      .get(input.item_id) as
      | {
          item_id: number;
          item_name: string;
          item_price: number;
          item_amount: number;
          item_barcode: string;
        }
      | undefined;

    if (!item) {
      throw new WasteError("ไม่พบสินค้ารหัสนี้", "ITEM_NOT_FOUND");
    }

    if (item.item_amount < input.quantity) {
      throw new WasteError(
        `สต็อกไม่เพียงพอสำหรับการตัดของเสีย (คงเหลือ ${item.item_amount} ชิ้น, ต้องการตัดออก ${input.quantity} ชิ้น)`,
        "INSUFFICIENT_STOCK"
      );
    }

    const unitCost =
      typeof input.unit_cost === "number" && !isNaN(input.unit_cost) && input.unit_cost >= 0
        ? input.unit_cost
        : item.item_price;

    if (unitCost < 0) {
      throw new WasteError("ต้นทุนต่อหน่วยต้องไม่ติดลบ", "INVALID_COST");
    }

    const totalCost = unitCost * input.quantity;
    const remainingStock = item.item_amount - input.quantity;
    const stockAdjustmentReason = WASTE_TO_STOCK_REASON[input.reason];

    // 2. Decrement stock in items table
    db.prepare("UPDATE items SET item_amount = item_amount - ? WHERE item_id = ?").run(
      input.quantity,
      input.item_id
    );

    // 3. Record stock adjustment audit entry
    const trimmedNotes = input.notes ? input.notes.trim() : "";
    const adjustmentNote = trimmedNotes
      ? `[บันทึกของเสีย: ${input.reason}] ${trimmedNotes}`
      : `[บันทึกของเสีย: ${input.reason}]`;

    const adjustment = recordStockAdjustmentEntry(db, {
      item_id: input.item_id,
      change_qty: -input.quantity,
      previous_qty: item.item_amount,
      new_qty: remainingStock,
      reason: stockAdjustmentReason,
      reference_id: "WASTE-PENDING",
      note: adjustmentNote,
      user_id: input.user_id || null,
      user_name: input.user_name || null,
    });

    // 4. Insert waste record
    const insertWasteStmt = db.prepare(`
      INSERT INTO waste_records (
        item_id, quantity, unit_cost, total_cost, reason, notes, user_id, user_name, adjustment_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const wasteResult = insertWasteStmt.run(
      input.item_id,
      input.quantity,
      unitCost,
      totalCost,
      input.reason,
      trimmedNotes || null,
      input.user_id || null,
      input.user_name || null,
      adjustment.adjustment_id
    );

    const wasteId = Number(wasteResult.lastInsertRowid);
    const wasteRef = `WASTE-${wasteId}`;

    // 5. Update stock adjustment reference_id to match waste_id
    db.prepare("UPDATE stock_adjustments SET reference_id = ? WHERE adjustment_id = ?").run(
      wasteRef,
      adjustment.adjustment_id
    );

    // 6. Fetch created_at timestamp
    const row = db
      .prepare("SELECT created_at FROM waste_records WHERE waste_id = ?")
      .get(wasteId) as { created_at: string } | undefined;

    const wasteRecord: WasteRecord = {
      waste_id: wasteId,
      item_id: input.item_id,
      item_name: item.item_name,
      item_barcode: item.item_barcode,
      quantity: input.quantity,
      unit_cost: unitCost,
      total_cost: totalCost,
      reason: input.reason,
      notes: trimmedNotes || null,
      user_id: input.user_id || null,
      user_name: input.user_name || null,
      adjustment_id: adjustment.adjustment_id,
      created_at: row?.created_at || new Date().toISOString(),
    };

    return { waste: wasteRecord, remainingStock };
  };

  if (externalDb) {
    return execute();
  } else {
    return db.transaction(execute)();
  }
}

/**
 * Retrieves paginated waste records with search, filters, and comprehensive metrics.
 */
export function getWasteRecords(
  params: WasteFilterParams = {},
  externalDb?: Database.Database
): WasteListResult {
  const db = externalDb || getDb();
  ensureWasteTable(db);

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  const whereConditions: string[] = [];
  const queryParams: (string | number)[] = [];

  if (params.item_id !== undefined && params.item_id !== null && !isNaN(params.item_id)) {
    whereConditions.push("w.item_id = ?");
    queryParams.push(params.item_id);
  }

  if (params.reason && params.reason !== "all") {
    whereConditions.push("w.reason = ?");
    queryParams.push(params.reason);
  }

  if (params.startDate) {
    whereConditions.push("DATE(w.created_at) >= DATE(?)");
    queryParams.push(params.startDate);
  }

  if (params.endDate) {
    whereConditions.push("DATE(w.created_at) <= DATE(?)");
    queryParams.push(params.endDate);
  }

  if (params.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`;
    whereConditions.push(
      "(i.item_name LIKE ? OR i.item_barcode LIKE ? OR w.notes LIKE ? OR w.user_name LIKE ?)"
    );
    queryParams.push(term, term, term, term);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  // 1. Overall summary metrics
  const totalsSql = `
    SELECT
      COUNT(*) AS total_incidents,
      COALESCE(SUM(w.quantity), 0) AS total_quantity,
      COALESCE(SUM(w.total_cost), 0) AS total_loss_amount
    FROM waste_records w
    LEFT JOIN items i ON w.item_id = i.item_id
    ${whereClause}
  `;

  const totalsRow = db.prepare(totalsSql).get(...queryParams) as {
    total_incidents: number;
    total_quantity: number;
    total_loss_amount: number;
  };

  const totalIncidents = totalsRow?.total_incidents || 0;
  const totalQuantity = totalsRow?.total_quantity || 0;
  const totalLossAmount = Number((totalsRow?.total_loss_amount || 0).toFixed(2));
  const totalPages = Math.ceil(totalIncidents / limit) || 1;

  // 2. Metrics grouped by reason
  const defaultByReason: Record<WasteReason, WasteReasonMetric> = {
    damaged: { reason: "damaged", count: 0, quantity: 0, lossAmount: 0 },
    spoiled: { reason: "spoiled", count: 0, quantity: 0, lossAmount: 0 },
    expired: { reason: "expired", count: 0, quantity: 0, lossAmount: 0 },
    discarded: { reason: "discarded", count: 0, quantity: 0, lossAmount: 0 },
    other: { reason: "other", count: 0, quantity: 0, lossAmount: 0 },
  };

  const reasonSql = `
    SELECT
      w.reason,
      COUNT(*) AS count,
      COALESCE(SUM(w.quantity), 0) AS quantity,
      COALESCE(SUM(w.total_cost), 0) AS loss_amount
    FROM waste_records w
    LEFT JOIN items i ON w.item_id = i.item_id
    ${whereClause}
    GROUP BY w.reason
  `;

  const reasonRows = db.prepare(reasonSql).all(...queryParams) as Array<{
    reason: WasteReason;
    count: number;
    quantity: number;
    loss_amount: number;
  }>;

  for (const r of reasonRows) {
    if (defaultByReason[r.reason]) {
      defaultByReason[r.reason] = {
        reason: r.reason,
        count: r.count,
        quantity: r.quantity,
        lossAmount: Number((r.loss_amount || 0).toFixed(2)),
      };
    }
  }

  // 3. Top 5 wasted items
  const topItemsSql = `
    SELECT
      w.item_id,
      COALESCE(i.item_name, 'สินค้าที่ถูกลบ') AS item_name,
      COALESCE(i.item_barcode, '-') AS item_barcode,
      COALESCE(SUM(w.quantity), 0) AS quantity,
      COALESCE(SUM(w.total_cost), 0) AS total_loss
    FROM waste_records w
    LEFT JOIN items i ON w.item_id = i.item_id
    ${whereClause}
    GROUP BY w.item_id, i.item_name, i.item_barcode
    ORDER BY total_loss DESC, quantity DESC
    LIMIT 5
  `;

  const topItemRows = db.prepare(topItemsSql).all(...queryParams) as Array<{
    item_id: number;
    item_name: string;
    item_barcode: string;
    quantity: number;
    total_loss: number;
  }>;

  const topItems: TopWastedItem[] = topItemRows.map((row) => ({
    item_id: row.item_id,
    item_name: row.item_name,
    item_barcode: row.item_barcode,
    quantity: row.quantity,
    totalLoss: Number((row.total_loss || 0).toFixed(2)),
  }));

  // 4. Paginated records
  const listSql = `
    SELECT
      w.waste_id,
      w.item_id,
      i.item_name,
      i.item_barcode,
      w.quantity,
      w.unit_cost,
      w.total_cost,
      w.reason,
      w.notes,
      w.user_id,
      w.user_name,
      w.adjustment_id,
      w.created_at
    FROM waste_records w
    LEFT JOIN items i ON w.item_id = i.item_id
    ${whereClause}
    ORDER BY w.waste_id DESC
    LIMIT ? OFFSET ?
  `;

  const records = db
    .prepare(listSql)
    .all(...queryParams, limit, offset) as WasteRecord[];

  const summaryMetrics: WasteSummaryMetrics = {
    totalIncidents,
    totalQuantity,
    totalLossAmount,
    byReason: defaultByReason,
    topItems,
  };

  return {
    records,
    pagination: {
      total: totalIncidents,
      page,
      limit,
      totalPages,
    },
    metrics: summaryMetrics,
  };
}

/**
 * Returns chronological waste records for a single item.
 */
export function getItemWasteHistory(
  itemId: number,
  limit = 20,
  externalDb?: Database.Database
): WasteRecord[] {
  const db = externalDb || getDb();
  ensureWasteTable(db);

  const safeLimit = Math.min(100, Math.max(1, limit));

  const listSql = `
    SELECT
      w.waste_id,
      w.item_id,
      i.item_name,
      i.item_barcode,
      w.quantity,
      w.unit_cost,
      w.total_cost,
      w.reason,
      w.notes,
      w.user_id,
      w.user_name,
      w.adjustment_id,
      w.created_at
    FROM waste_records w
    LEFT JOIN items i ON w.item_id = i.item_id
    WHERE w.item_id = ?
    ORDER BY w.waste_id DESC
    LIMIT ?
  `;

  return db.prepare(listSql).all(itemId, safeLimit) as WasteRecord[];
}
