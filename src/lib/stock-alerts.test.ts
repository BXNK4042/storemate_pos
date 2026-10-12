import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  getDefaultLowStockThreshold,
  updateDefaultLowStockThreshold,
  getEffectiveThreshold,
  evaluateStockStatus,
  getLowStockSummary,
  getLowStockItems,
  StockAlertError,
  DEFAULT_LOW_STOCK_THRESHOLD,
} from "./stock-alerts";
import { ensureSettingsTable } from "./settings";
import { adjustItemStock, ensureStockAdjustmentTable } from "./stock";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      item_price INTEGER NOT NULL,
      item_amount INTEGER NOT NULL,
      item_barcode TEXT NOT NULL,
      item_image TEXT,
      expiry_date TEXT,
      low_stock_threshold INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      user_password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureSettingsTable(db);
  ensureStockAdjustmentTable(db);

  // Seed user
  db.prepare(`
    INSERT INTO users (user_id, user_name, user_role, user_password)
    VALUES (1, 'admin', 'admin', 'pass123')
  `).run();

  // Seed sample items:
  // Item 1: normal stock (20), default threshold (5) -> normal
  // Item 2: low stock (4), default threshold (5) -> low_stock
  // Item 3: out of stock (0), default threshold (5) -> out_of_stock
  // Item 4: custom threshold 15, stock 10 -> low_stock (since 10 <= 15)
  // Item 5: custom threshold 2, stock 3 -> normal (since 3 > 2)
  db.prepare(`
    INSERT INTO items (item_id, item_name, item_price, item_amount, item_barcode, low_stock_threshold)
    VALUES 
      (1, 'Item 1 - Normal', 20, 20, '111111', NULL),
      (2, 'Item 2 - Low', 30, 4, '222222', NULL),
      (3, 'Item 3 - Out', 15, 0, '333333', NULL),
      (4, 'Item 4 - Custom Low', 50, 10, '444444', 15),
      (5, 'Item 5 - Custom OK', 40, 3, '555555', 2)
  `).run();

  return db;
}

describe("Low Stock Alerts: Threshold Evaluation Invariants", () => {
  it("getEffectiveThreshold returns custom threshold when valid number > 0 is provided", () => {
    assert.equal(getEffectiveThreshold(10, 5), 10);
    assert.equal(getEffectiveThreshold(1, 5), 1);
    assert.equal(getEffectiveThreshold(12.7, 5), 12); // Math.floor
  });

  it("getEffectiveThreshold falls back to store default when null, undefined, 0, or negative", () => {
    assert.equal(getEffectiveThreshold(null, 5), 5);
    assert.equal(getEffectiveThreshold(undefined, 5), 5);
    assert.equal(getEffectiveThreshold(0, 5), 5);
    assert.equal(getEffectiveThreshold(-3, 5), 5);
    assert.equal(getEffectiveThreshold(null, 10), 10);
  });

  it("evaluateStockStatus correctly classifies out_of_stock (amount <= 0)", () => {
    const zeroStock = evaluateStockStatus(0, 5);
    assert.equal(zeroStock.status, "out_of_stock");
    assert.equal(zeroStock.isAttentionNeeded, true);
    assert.equal(zeroStock.label, "สินค้าหมด");

    const negativeStock = evaluateStockStatus(-2, 5);
    assert.equal(negativeStock.status, "out_of_stock");
    assert.equal(negativeStock.isAttentionNeeded, true);
  });

  it("evaluateStockStatus correctly classifies boundary values for low_stock and normal", () => {
    // Exact threshold is low_stock
    const atThreshold = evaluateStockStatus(5, 5);
    assert.equal(atThreshold.status, "low_stock");
    assert.equal(atThreshold.isAttentionNeeded, true);
    assert.equal(atThreshold.label, "สต็อกใกล้หมด");

    // Below threshold is low_stock
    const belowThreshold = evaluateStockStatus(4, 5);
    assert.equal(belowThreshold.status, "low_stock");
    assert.equal(belowThreshold.isAttentionNeeded, true);

    // One above threshold is normal
    const aboveThreshold = evaluateStockStatus(6, 5);
    assert.equal(aboveThreshold.status, "normal");
    assert.equal(aboveThreshold.isAttentionNeeded, false);
    assert.equal(aboveThreshold.label, "ปกติ");
  });

  it("evaluateStockStatus preserves isCustomThreshold flag", () => {
    const custom = evaluateStockStatus(8, 10, true);
    assert.equal(custom.isCustomThreshold, true);
    assert.equal(custom.effectiveThreshold, 10);

    const nonCustom = evaluateStockStatus(8, 10, false);
    assert.equal(nonCustom.isCustomThreshold, false);
  });
});

describe("Low Stock Alerts: Settings Invariants", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("getDefaultLowStockThreshold returns default 5 initially", () => {
    assert.equal(getDefaultLowStockThreshold(db), DEFAULT_LOW_STOCK_THRESHOLD);
  });

  it("updateDefaultLowStockThreshold updates setting and returns new threshold", () => {
    const updated = updateDefaultLowStockThreshold(12, db);
    assert.equal(updated, 12);
    assert.equal(getDefaultLowStockThreshold(db), 12);
  });

  it("updateDefaultLowStockThreshold rejects values < 1 or > 1000 or non-integers", () => {
    assert.throws(
      () => updateDefaultLowStockThreshold(0, db),
      (err: unknown) => err instanceof StockAlertError && err.code === "INVALID_THRESHOLD"
    );
    assert.throws(
      () => updateDefaultLowStockThreshold(-5, db),
      (err: unknown) => err instanceof StockAlertError && err.code === "INVALID_THRESHOLD"
    );
    assert.throws(
      () => updateDefaultLowStockThreshold(1001, db),
      (err: unknown) => err instanceof StockAlertError && err.code === "INVALID_THRESHOLD"
    );
    assert.throws(
      () => updateDefaultLowStockThreshold(5.5, db),
      (err: unknown) => err instanceof StockAlertError && err.code === "INVALID_THRESHOLD"
    );
  });
});

describe("Low Stock Alerts: Database Invariants & Queries", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("getLowStockSummary accurately computes total, outOfStock, and lowStock counts", () => {
    // Items:
    // Item 1: stock 20 (normal)
    // Item 2: stock 4 (low_stock)
    // Item 3: stock 0 (out_of_stock)
    // Item 4: stock 10, thresh 15 (low_stock)
    // Item 5: stock 3, thresh 2 (normal)
    const summary = getLowStockSummary(db);

    assert.equal(summary.totalProducts, 5);
    assert.equal(summary.outOfStockCount, 1); // Item 3
    assert.equal(summary.lowStockCount, 2);   // Item 2 (4 <= 5), Item 4 (10 <= 15)
    assert.equal(summary.attentionCount, 3);   // 1 + 2
    assert.equal(summary.defaultThreshold, 5);
  });

  it("changing default threshold dynamically alters lowStockCount in summary", () => {
    // Increase store threshold to 25
    updateDefaultLowStockThreshold(25, db);
    const summary = getLowStockSummary(db);

    // Item 1: stock 20 <= 25 -> now low_stock!
    // Item 2: stock 4 <= 25 -> low_stock
    // Item 3: stock 0 -> out_of_stock
    // Item 4: custom thresh 15, stock 10 <= 15 -> low_stock
    // Item 5: custom thresh 2, stock 3 > 2 -> normal (still normal because of custom override)
    assert.equal(summary.outOfStockCount, 1);
    assert.equal(summary.lowStockCount, 3); // Item 1, 2, 4
    assert.equal(summary.attentionCount, 4);
  });

  it("getLowStockItems returns all attention items sorted by stock ascending", () => {
    const items = getLowStockItems({ filter: "all" }, db);

    assert.equal(items.length, 3);
    assert.equal(items[0].item_id, 3); // stock 0
    assert.equal(items[0].stockAlert.status, "out_of_stock");

    assert.equal(items[1].item_id, 2); // stock 4
    assert.equal(items[1].stockAlert.status, "low_stock");
    assert.equal(items[1].stockAlert.isCustomThreshold, false);

    assert.equal(items[2].item_id, 4); // stock 10
    assert.equal(items[2].stockAlert.status, "low_stock");
    assert.equal(items[2].stockAlert.isCustomThreshold, true);
    assert.equal(items[2].stockAlert.effectiveThreshold, 15);
  });

  it("getLowStockItems respects out_of_stock and low_stock filters", () => {
    const outItems = getLowStockItems({ filter: "out_of_stock" }, db);
    assert.equal(outItems.length, 1);
    assert.equal(outItems[0].item_id, 3);

    const lowItems = getLowStockItems({ filter: "low_stock" }, db);
    assert.equal(lowItems.length, 2);
    assert.deepEqual(
      lowItems.map((i) => i.item_id),
      [2, 4]
    );
  });

  it("stock decrement across threshold triggers low stock state and adjustment increment clears it", () => {
    // Item 1 has 20 units (normal). Let's remove 16 units -> 4 units (<= 5)
    adjustItemStock(
      {
        item_id: 1,
        mode: "remove",
        quantity: 16,
        reason: "sale",
        user_id: 1,
        user_name: "admin",
      },
      db
    );

    let summary = getLowStockSummary(db);
    assert.equal(summary.lowStockCount, 3); // Item 1 is now low stock

    // Now replenish item 1 by adding 10 units -> 14 units (> 5)
    adjustItemStock(
      {
        item_id: 1,
        mode: "add",
        quantity: 10,
        reason: "restock",
        user_id: 1,
        user_name: "admin",
      },
      db
    );

    summary = getLowStockSummary(db);
    assert.equal(summary.lowStockCount, 2); // Item 1 cleared from low stock
  });
});
