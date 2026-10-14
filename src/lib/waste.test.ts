import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  logWasteItem,
  getWasteRecords,
  getItemWasteHistory,
  ensureWasteTable,
  WasteError,
} from "./waste";
import { ensureStockAdjustmentTable } from "./stock";
import { getLocalDateString } from "./date-utils";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      item_price INTEGER NOT NULL,
      item_amount INTEGER NOT NULL,
      item_barcode TEXT NOT NULL,
      expiry_date TEXT,
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

  ensureStockAdjustmentTable(db);
  ensureWasteTable(db);

  // Seed user
  db.prepare(`
    INSERT INTO users (user_id, user_name, user_role, user_password)
    VALUES (1, 'cashier1', 'cashier', 'pass123')
  `).run();

  // Seed items
  db.prepare(`
    INSERT INTO items (item_id, item_name, item_price, item_amount, item_barcode)
    VALUES (1, 'Milk 1000ml', 45, 15, '8850001001')
  `).run();

  db.prepare(`
    INSERT INTO items (item_id, item_name, item_price, item_amount, item_barcode)
    VALUES (2, 'Egg Box 10pcs', 60, 20, '8850001002')
  `).run();

  db.prepare(`
    INSERT INTO items (item_id, item_name, item_price, item_amount, item_barcode)
    VALUES (3, 'Bread Loaf', 35, 5, '8850001003')
  `).run();

  return db;
}

describe("Waste Tracking: Mathematical & Stock Invariants", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("logging waste deducts item stock accurately", () => {
    const result = logWasteItem(
      {
        item_id: 1,
        quantity: 3,
        reason: "spoiled",
        notes: "Carton leaked in cooler",
        user_id: 1,
        user_name: "cashier1",
      },
      db
    );

    assert.equal(result.remainingStock, 12);

    // Verify in db
    const item = db.prepare("SELECT item_amount FROM items WHERE item_id = 1").get() as {
      item_amount: number;
    };
    assert.equal(item.item_amount, 12);
  });

  it("logging waste creates an immutable record in waste_records", () => {
    const result = logWasteItem(
      {
        item_id: 2,
        quantity: 5,
        reason: "damaged",
        notes: "Dropped during restocking",
        unit_cost: 55,
        user_id: 1,
        user_name: "cashier1",
      },
      db
    );

    assert.ok(result.waste.waste_id > 0);
    assert.equal(result.waste.item_id, 2);
    assert.equal(result.waste.item_name, "Egg Box 10pcs");
    assert.equal(result.waste.item_barcode, "8850001002");
    assert.equal(result.waste.quantity, 5);
    assert.equal(result.waste.unit_cost, 55);
    assert.equal(result.waste.total_cost, 275);
    assert.equal(result.waste.reason, "damaged");
    assert.equal(result.waste.notes, "Dropped during restocking");
    assert.equal(result.waste.user_id, 1);
    assert.equal(result.waste.user_name, "cashier1");
    assert.ok(result.waste.adjustment_id! > 0);
  });

  it("logging waste creates a linked entry in stock_adjustments with reference_id = WASTE-{id}", () => {
    const result = logWasteItem(
      {
        item_id: 3,
        quantity: 2,
        reason: "expired",
        notes: "Best before date passed",
        user_id: 1,
        user_name: "cashier1",
      },
      db
    );

    const adjustment = db
      .prepare("SELECT * FROM stock_adjustments WHERE adjustment_id = ?")
      .get(result.waste.adjustment_id) as {
      adjustment_id: number;
      item_id: number;
      change_qty: number;
      previous_qty: number;
      new_qty: number;
      reason: string;
      reference_id: string;
      note: string;
    };

    assert.ok(adjustment);
    assert.equal(adjustment.item_id, 3);
    assert.equal(adjustment.change_qty, -2);
    assert.equal(adjustment.previous_qty, 5);
    assert.equal(adjustment.new_qty, 3);
    assert.equal(adjustment.reason, "expired");
    assert.equal(adjustment.reference_id, `WASTE-${result.waste.waste_id}`);
    assert.ok(adjustment.note.includes("Best before date passed"));
  });

  it("throws INSUFFICIENT_STOCK when quantity exceeds current stock", () => {
    assert.throws(
      () => {
        logWasteItem(
          {
            item_id: 3,
            quantity: 10, // Stock is only 5
            reason: "discarded",
          },
          db
        );
      },
      (err: unknown) => {
        return (
          err instanceof WasteError &&
          err.code === "INSUFFICIENT_STOCK" &&
          err.message.includes("สต็อกไม่เพียงพอ")
        );
      }
    );

    // Verify stock unchanged
    const item = db.prepare("SELECT item_amount FROM items WHERE item_id = 3").get() as {
      item_amount: number;
    };
    assert.equal(item.item_amount, 5);
  });

  it("throws INVALID_QUANTITY when quantity <= 0 or not an integer", () => {
    assert.throws(
      () => {
        logWasteItem({ item_id: 1, quantity: 0, reason: "damaged" }, db);
      },
      (err: unknown) => err instanceof WasteError && err.code === "INVALID_QUANTITY"
    );

    assert.throws(
      () => {
        logWasteItem({ item_id: 1, quantity: -2, reason: "damaged" }, db);
      },
      (err: unknown) => err instanceof WasteError && err.code === "INVALID_QUANTITY"
    );

    assert.throws(
      () => {
        logWasteItem({ item_id: 1, quantity: 2.5, reason: "damaged" }, db);
      },
      (err: unknown) => err instanceof WasteError && err.code === "INVALID_QUANTITY"
    );
  });

  it("throws ITEM_NOT_FOUND when item does not exist", () => {
    assert.throws(
      () => {
        logWasteItem({ item_id: 9999, quantity: 1, reason: "damaged" }, db);
      },
      (err: unknown) => err instanceof WasteError && err.code === "ITEM_NOT_FOUND"
    );
  });

  it("throws INVALID_REASON when reason is invalid", () => {
    assert.throws(
      () => {
        logWasteItem(
          {
            item_id: 1,
            quantity: 1,
            reason: "invalid_reason" as unknown as "damaged",
          },
          db
        );
      },
      (err: unknown) => err instanceof WasteError && err.code === "INVALID_REASON"
    );
  });
});

describe("Waste Tracking: Financial Calculations", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("uses item_price as fallback unit_cost when not provided", () => {
    // Milk item_price = 45
    const result = logWasteItem(
      {
        item_id: 1,
        quantity: 4,
        reason: "spoiled",
      },
      db
    );

    assert.equal(result.waste.unit_cost, 45);
    assert.equal(result.waste.total_cost, 180);
  });

  it("correctly calculates total_cost when custom unit_cost is specified", () => {
    const result = logWasteItem(
      {
        item_id: 1,
        quantity: 2,
        reason: "damaged",
        unit_cost: 38.5,
      },
      db
    );

    assert.equal(result.waste.unit_cost, 38.5);
    assert.equal(result.waste.total_cost, 77);
  });
});

describe("Waste Tracking: Filtering & Aggregation", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();

    // Insert multiple waste records across items and reasons
    logWasteItem(
      { item_id: 1, quantity: 2, reason: "damaged", notes: "Cracked cap", unit_cost: 45 },
      db
    );
    logWasteItem(
      { item_id: 1, quantity: 3, reason: "spoiled", notes: "Sour smell", unit_cost: 45 },
      db
    );
    logWasteItem(
      { item_id: 2, quantity: 4, reason: "expired", notes: "Overdue 2 days", unit_cost: 60 },
      db
    );
    logWasteItem(
      { item_id: 3, quantity: 1, reason: "discarded", notes: "Mold spots", unit_cost: 35 },
      db
    );
  });

  it("correctly aggregates totalIncidents, totalQuantity, totalLossAmount and byReason", () => {
    const result = getWasteRecords({}, db);

    assert.equal(result.records.length, 4);
    assert.equal(result.metrics.totalIncidents, 4);
    assert.equal(result.metrics.totalQuantity, 10); // 2 + 3 + 4 + 1
    // Total cost: (2*45) + (3*45) + (4*60) + (1*35) = 90 + 135 + 240 + 35 = 500
    assert.equal(result.metrics.totalLossAmount, 500);

    // byReason breakdown
    assert.equal(result.metrics.byReason.damaged.count, 1);
    assert.equal(result.metrics.byReason.damaged.quantity, 2);
    assert.equal(result.metrics.byReason.damaged.lossAmount, 90);

    assert.equal(result.metrics.byReason.spoiled.count, 1);
    assert.equal(result.metrics.byReason.spoiled.quantity, 3);
    assert.equal(result.metrics.byReason.spoiled.lossAmount, 135);

    assert.equal(result.metrics.byReason.expired.count, 1);
    assert.equal(result.metrics.byReason.expired.quantity, 4);
    assert.equal(result.metrics.byReason.expired.lossAmount, 240);

    assert.equal(result.metrics.byReason.discarded.count, 1);
    assert.equal(result.metrics.byReason.discarded.quantity, 1);
    assert.equal(result.metrics.byReason.discarded.lossAmount, 35);

    assert.equal(result.metrics.byReason.other.count, 0);

    // Top items
    assert.equal(result.metrics.topItems.length, 3);
    assert.equal(result.metrics.topItems[0].item_id, 2); // Egg: 240 loss
    assert.equal(result.metrics.topItems[0].totalLoss, 240);
  });

  it("filters accurately by reason", () => {
    const result = getWasteRecords({ reason: "damaged" }, db);
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].reason, "damaged");
    assert.equal(result.metrics.totalIncidents, 1);
    assert.equal(result.metrics.totalQuantity, 2);
  });

  it("filters accurately by item_id", () => {
    const result = getWasteRecords({ item_id: 1 }, db);
    assert.equal(result.records.length, 2);
    assert.equal(result.metrics.totalQuantity, 5);
  });

  it("searches across item name, barcode, and notes", () => {
    const resByName = getWasteRecords({ search: "Milk" }, db);
    assert.equal(resByName.records.length, 2);

    const resByBarcode = getWasteRecords({ search: "8850001003" }, db);
    assert.equal(resByBarcode.records.length, 1);
    assert.equal(resByBarcode.records[0].item_name, "Bread Loaf");

    const resByNotes = getWasteRecords({ search: "Cracked cap" }, db);
    assert.equal(resByNotes.records.length, 1);
  });

  it("filters by date range", () => {
    const today = getLocalDateString();
    const res = getWasteRecords({ startDate: today, endDate: today }, db);
    assert.equal(res.records.length, 4);

    const resPast = getWasteRecords({ startDate: "2020-01-01", endDate: "2020-01-02" }, db);
    assert.equal(resPast.records.length, 0);
  });

  it("supports pagination with page and limit", () => {
    const page1 = getWasteRecords({ page: 1, limit: 2 }, db);
    assert.equal(page1.records.length, 2);
    assert.equal(page1.pagination.total, 4);
    assert.equal(page1.pagination.totalPages, 2);
    assert.equal(page1.pagination.page, 1);

    const page2 = getWasteRecords({ page: 2, limit: 2 }, db);
    assert.equal(page2.records.length, 2);
    assert.equal(page2.pagination.page, 2);
    assert.notEqual(page1.records[0].waste_id, page2.records[0].waste_id);
  });

  it("getItemWasteHistory returns single item history", () => {
    const history = getItemWasteHistory(1, 10, db);
    assert.equal(history.length, 2);
    assert.ok(history[0].waste_id > history[1].waste_id); // Descending order
  });
});
