import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  adjustItemStock,
  recordStockAdjustmentEntry,
  getStockAdjustments,
  getItemStockHistory,
  StockError,
  ensureStockAdjustmentTable,
} from "./stock";

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

  // Seed sample user and item
  db.prepare(`
    INSERT INTO users (user_id, user_name, user_role, user_password)
    VALUES (1, 'admin', 'admin', 'pass123')
  `).run();

  db.prepare(`
    INSERT INTO items (item_id, item_name, item_price, item_amount, item_barcode)
    VALUES (1, 'Green Tea 500ml', 25, 20, '8850000001')
  `).run();

  db.prepare(`
    INSERT INTO items (item_id, item_name, item_price, item_amount, item_barcode)
    VALUES (2, 'Potato Chips 50g', 30, 5, '8850000002')
  `).run();

  return db;
}

describe("Stock Adjustment: Mathematical & State Invariants", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("mode 'add' correctly increases inventory and records audit log", () => {
    const result = adjustItemStock(
      {
        item_id: 1,
        mode: "add",
        quantity: 15,
        reason: "restock",
        note: "Received shipment",
        user_id: 1,
        user_name: "admin",
      },
      db
    );

    assert.equal(result.currentAmount, 35);
    assert.equal(result.adjustment.previous_qty, 20);
    assert.equal(result.adjustment.change_qty, 15);
    assert.equal(result.adjustment.new_qty, 35);
    assert.equal(result.adjustment.reason, "restock");
    assert.equal(result.adjustment.user_name, "admin");

    // Invariant: new_qty === previous_qty + change_qty
    assert.equal(
      result.adjustment.new_qty,
      result.adjustment.previous_qty + result.adjustment.change_qty
    );

    // Verify DB state
    const item = db.prepare("SELECT item_amount FROM items WHERE item_id = 1").get() as {
      item_amount: number;
    };
    assert.equal(item.item_amount, 35);
  });

  it("mode 'remove' correctly decreases inventory and records negative change_qty", () => {
    const result = adjustItemStock(
      {
        item_id: 1,
        mode: "remove",
        quantity: 8,
        reason: "damage",
        note: "Cracked bottles",
        user_id: 1,
        user_name: "admin",
      },
      db
    );

    assert.equal(result.currentAmount, 12);
    assert.equal(result.adjustment.previous_qty, 20);
    assert.equal(result.adjustment.change_qty, -8);
    assert.equal(result.adjustment.new_qty, 12);
    assert.equal(result.adjustment.reason, "damage");

    assert.equal(
      result.adjustment.new_qty,
      result.adjustment.previous_qty + result.adjustment.change_qty
    );
  });

  it("mode 'set' correctly updates stock count upwards and downwards", () => {
    // Upwards adjustment: 20 -> 50 (+30)
    const set1 = adjustItemStock(
      {
        item_id: 1,
        mode: "set",
        quantity: 50,
        reason: "inventory_count",
        note: "Annual inventory audit count",
      },
      db
    );
    assert.equal(set1.currentAmount, 50);
    assert.equal(set1.adjustment.change_qty, 30);
    assert.equal(set1.adjustment.new_qty, 50);

    // Downwards adjustment: 50 -> 45 (-5)
    const set2 = adjustItemStock(
      {
        item_id: 1,
        mode: "set",
        quantity: 45,
        reason: "inventory_count",
      },
      db
    );
    assert.equal(set2.currentAmount, 45);
    assert.equal(set2.adjustment.change_qty, -5);
    assert.equal(set2.adjustment.new_qty, 45);
  });

  it("rejects stock removal exceeding available stock (INSUFFICIENT_STOCK)", () => {
    assert.throws(
      () => {
        adjustItemStock(
          {
            item_id: 2, // has 5 units
            mode: "remove",
            quantity: 10,
            reason: "damage",
          },
          db
        );
      },
      (err: unknown) => {
        return err instanceof StockError && err.code === "INSUFFICIENT_STOCK";
      }
    );

    // Check item amount did not change
    const item = db.prepare("SELECT item_amount FROM items WHERE item_id = 2").get() as {
      item_amount: number;
    };
    assert.equal(item.item_amount, 5);
  });

  it("rejects non-positive quantities in 'add' and 'remove' modes", () => {
    assert.throws(
      () => {
        adjustItemStock(
          {
            item_id: 1,
            mode: "add",
            quantity: 0,
            reason: "restock",
          },
          db
        );
      },
      (err: unknown) => err instanceof StockError && err.code === "INVALID_QUANTITY"
    );

    assert.throws(
      () => {
        adjustItemStock(
          {
            item_id: 1,
            mode: "remove",
            quantity: -5,
            reason: "loss",
          },
          db
        );
      },
      (err: unknown) => err instanceof StockError && err.code === "INVALID_QUANTITY"
    );
  });

  it("rejects negative target quantity in 'set' mode", () => {
    assert.throws(
      () => {
        adjustItemStock(
          {
            item_id: 1,
            mode: "set",
            quantity: -1,
            reason: "inventory_count",
          },
          db
        );
      },
      (err: unknown) => err instanceof StockError && err.code === "INVALID_QUANTITY"
    );
  });

  it("rejects invalid adjustment reasons", () => {
    assert.throws(
      () => {
        adjustItemStock(
          {
            item_id: 1,
            mode: "add",
            quantity: 5,
            reason: "invalid_reason" as unknown as import("@/types/stock").StockAdjustmentReason,
          },
          db
        );
      },
      (err: unknown) => err instanceof StockError && err.code === "INVALID_REASON"
    );
  });

  it("throws ITEM_NOT_FOUND when modifying nonexistent item", () => {
    assert.throws(
      () => {
        adjustItemStock(
          {
            item_id: 9999,
            mode: "add",
            quantity: 5,
            reason: "restock",
          },
          db
        );
      },
      (err: unknown) => err instanceof StockError && err.code === "ITEM_NOT_FOUND"
    );
  });
});

describe("Stock Adjustment: Query, Filtering & Metrics", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();

    // Insert multiple adjustments
    adjustItemStock(
      {
        item_id: 1,
        mode: "add",
        quantity: 10,
        reason: "restock",
        reference_id: "PO-100",
        note: "Batch 1 received",
      },
      db
    );

    adjustItemStock(
      {
        item_id: 1,
        mode: "remove",
        quantity: 2,
        reason: "damage",
        note: "Broken cap",
      },
      db
    );

    adjustItemStock(
      {
        item_id: 2,
        mode: "remove",
        quantity: 3,
        reason: "expired",
        note: "Passed expiration date",
      },
      db
    );

    adjustItemStock(
      {
        item_id: 2,
        mode: "add",
        quantity: 20,
        reason: "restock",
        reference_id: "PO-101",
        note: "Fresh batch chips",
      },
      db
    );
  });

  it("correctly calculates aggregate metrics (totalIn, totalOut, netChange, recordCount)", () => {
    const res = getStockAdjustments({}, db);
    assert.equal(res.pagination.total, 4);
    assert.equal(res.metrics.recordCount, 4);
    assert.equal(res.metrics.totalIn, 30); // 10 + 20
    assert.equal(res.metrics.totalOut, 5); // 2 + 3
    assert.equal(res.metrics.netChange, 25); // 30 - 5
  });

  it("filters correctly by item_id", () => {
    const res = getStockAdjustments({ item_id: 1 }, db);
    assert.equal(res.pagination.total, 2);
    assert.equal(res.metrics.totalIn, 10);
    assert.equal(res.metrics.totalOut, 2);
    assert.equal(res.metrics.netChange, 8);
    for (const adj of res.adjustments) {
      assert.equal(adj.item_id, 1);
    }
  });

  it("filters correctly by reason code", () => {
    const res = getStockAdjustments({ reason: "damage" }, db);
    assert.equal(res.pagination.total, 1);
    assert.equal(res.adjustments[0].reason, "damage");
    assert.equal(res.adjustments[0].change_qty, -2);
  });

  it("searches text across item name, barcode, notes, and references", () => {
    const byName = getStockAdjustments({ search: "Green Tea" }, db);
    assert.equal(byName.pagination.total, 2);

    const byRef = getStockAdjustments({ search: "PO-101" }, db);
    assert.equal(byRef.pagination.total, 1);
    assert.equal(byRef.adjustments[0].reference_id, "PO-101");

    const byNote = getStockAdjustments({ search: "Broken cap" }, db);
    assert.equal(byNote.pagination.total, 1);
    assert.equal(byNote.adjustments[0].note, "Broken cap");
  });

  it("supports pagination with page and limit", () => {
    const page1 = getStockAdjustments({ page: 1, limit: 2 }, db);
    assert.equal(page1.adjustments.length, 2);
    assert.equal(page1.pagination.page, 1);
    assert.equal(page1.pagination.limit, 2);
    assert.equal(page1.pagination.totalPages, 2);

    const page2 = getStockAdjustments({ page: 2, limit: 2 }, db);
    assert.equal(page2.adjustments.length, 2);
    assert.equal(page2.pagination.page, 2);
    assert.notEqual(page1.adjustments[0].adjustment_id, page2.adjustments[0].adjustment_id);
  });

  it("getItemStockHistory returns chronological history for single item", () => {
    const history = getItemStockHistory(1, 10, db);
    assert.equal(history.length, 2);
    // Ordered by adjustment_id DESC
    assert.ok(history[0].adjustment_id > history[1].adjustment_id);
    assert.equal(history[0].reason, "damage");
    assert.equal(history[1].reason, "restock");
  });
});

describe("Stock Adjustment: Subsystem Integration Hooks", () => {
  it("recordStockAdjustmentEntry correctly records direct transaction", () => {
    const db = createTestDb();
    const entry = recordStockAdjustmentEntry(db, {
      item_id: 1,
      change_qty: -3,
      previous_qty: 20,
      new_qty: 17,
      reason: "sale",
      reference_id: "ORDER-99",
      note: "POS Sale test",
      user_name: "cashier1",
    });

    assert.equal(entry.reason, "sale");
    assert.equal(entry.reference_id, "ORDER-99");
    assert.equal(entry.change_qty, -3);
    assert.equal(entry.new_qty, 17);
    assert.equal(entry.user_name, "cashier1");

    const logs = getItemStockHistory(1, 10, db);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].reason, "sale");
  });
});
