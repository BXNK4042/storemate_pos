import type Database from "better-sqlite3";
import getDb from "./db";
import { ensureSettingsTable } from "./settings";
import type {
  LowStockSummary,
  ItemWithStockAlert,
} from "@/types/stock";
import type { Item } from "@/types/item";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  MIN_STOCK_THRESHOLD,
  MAX_STOCK_THRESHOLD,
  StockAlertError,
  getEffectiveThreshold,
  evaluateStockStatus,
} from "./stock-alerts-eval";

export * from "./stock-alerts-eval";

/**
 * Get storewide default low stock threshold from settings.
 */
export function getDefaultLowStockThreshold(dbInstance?: Database.Database): number {
  const db = dbInstance ?? getDb();
  ensureSettingsTable(db);

  try {
    const row = db
      .prepare("SELECT value FROM settings WHERE key = 'stock_default_low_threshold'")
      .get() as { value: string } | undefined;

    if (!row || !row.value) {
      return DEFAULT_LOW_STOCK_THRESHOLD;
    }

    const parsed = parseInt(row.value, 10);
    if (isNaN(parsed) || parsed < MIN_STOCK_THRESHOLD) {
      return DEFAULT_LOW_STOCK_THRESHOLD;
    }
    return Math.min(parsed, MAX_STOCK_THRESHOLD);
  } catch {
    return DEFAULT_LOW_STOCK_THRESHOLD;
  }
}

/**
 * Update storewide default low stock threshold in settings.
 */
export function updateDefaultLowStockThreshold(
  threshold: number,
  dbInstance?: Database.Database
): number {
  if (
    !Number.isInteger(threshold) ||
    threshold < MIN_STOCK_THRESHOLD ||
    threshold > MAX_STOCK_THRESHOLD
  ) {
    throw new StockAlertError(
      `ค่าเกณฑ์สต็อกต้องเป็นจำนวนเต็มตั้งแต่ ${MIN_STOCK_THRESHOLD} ถึง ${MAX_STOCK_THRESHOLD}`,
      "INVALID_THRESHOLD"
    );
  }

  const db = dbInstance ?? getDb();
  ensureSettingsTable(db);

  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES ('stock_default_low_threshold', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).run(String(threshold));

  return threshold;
}

/**
 * Retrieve high-level summary of low stock and out-of-stock counts across the store.
 */
export function getLowStockSummary(dbInstance?: Database.Database): LowStockSummary {
  const db = dbInstance ?? getDb();
  const defaultThreshold = getDefaultLowStockThreshold(db);

  const query = `
    SELECT 
      COUNT(item_id) AS totalProducts,
      COALESCE(SUM(CASE WHEN item_amount <= 0 THEN 1 ELSE 0 END), 0) AS outOfStockCount,
      COALESCE(SUM(CASE 
        WHEN item_amount > 0 AND item_amount <= COALESCE(low_stock_threshold, ?) 
        THEN 1 ELSE 0 END), 0) AS lowStockCount
    FROM items;
  `;

  const row = db.prepare(query).get(defaultThreshold) as {
    totalProducts: number;
    outOfStockCount: number;
    lowStockCount: number;
  };

  const totalProducts = Number(row?.totalProducts || 0);
  const outOfStockCount = Number(row?.outOfStockCount || 0);
  const lowStockCount = Number(row?.lowStockCount || 0);
  const attentionCount = outOfStockCount + lowStockCount;

  return {
    totalProducts,
    outOfStockCount,
    lowStockCount,
    attentionCount,
    defaultThreshold,
  };
}

/**
 * Retrieve items needing attention (low stock or out of stock) decorated with StockAlertInfo.
 */
export function getLowStockItems(
  options?: { filter?: "all" | "out_of_stock" | "low_stock" },
  dbInstance?: Database.Database
): ItemWithStockAlert[] {
  const db = dbInstance ?? getDb();
  const defaultThreshold = getDefaultLowStockThreshold(db);
  const filter = options?.filter ?? "all";

  let whereClause = "WHERE item_amount <= COALESCE(low_stock_threshold, ?)";
  const params: (number | string)[] = [defaultThreshold];

  if (filter === "out_of_stock") {
    whereClause = "WHERE item_amount <= 0";
    params.length = 0;
  } else if (filter === "low_stock") {
    whereClause = "WHERE item_amount > 0 AND item_amount <= COALESCE(low_stock_threshold, ?)";
  }

  const query = `
    SELECT 
      item_id,
      item_name,
      item_price,
      item_amount,
      item_barcode,
      item_image,
      expiry_date,
      low_stock_threshold
    FROM items
    ${whereClause}
    ORDER BY item_amount ASC, item_id ASC
  `;

  const rows = db.prepare(query).all(...params) as Item[];

  return rows.map((item) => {
    const isCustomThreshold =
      item.low_stock_threshold !== null &&
      item.low_stock_threshold !== undefined &&
      item.low_stock_threshold > 0;
    const effectiveThreshold = getEffectiveThreshold(
      item.low_stock_threshold,
      defaultThreshold
    );
    const stockAlert = evaluateStockStatus(
      item.item_amount,
      effectiveThreshold,
      isCustomThreshold
    );

    return {
      ...item,
      stockAlert,
    };
  });
}
