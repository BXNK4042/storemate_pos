import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
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

    CREATE TABLE IF NOT EXISTS active_cart (
      item_id INTEGER PRIMARY KEY,
      quantity INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE
    );
  `);

  db.prepare(`
    INSERT INTO items (item_id, item_name, item_price, item_amount, item_barcode)
    VALUES (1, 'Green Tea 500ml', 25, 20, '8850000001')
  `).run();

  db.prepare(`
    INSERT INTO items (item_id, item_name, item_price, item_amount, item_barcode)
    VALUES (2, 'Potato Chips 50g', 30, 5, '8850000002')
  `).run();

  db.prepare(`
    INSERT INTO items (item_id, item_name, item_price, item_amount, item_barcode)
    VALUES (3, 'Mineral Water', 10, 50, '8850000003')
  `).run();

  return db;
}

describe("Active Cart DB Sync: Upsert, Total, and Clear", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("upserts active_cart: inserts initial item with quantity = 1 and increments on conflict", () => {
    const upsertStmt = db.prepare(
      "INSERT INTO active_cart (item_id, quantity) VALUES (?, 1) ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + 1"
    );

    // Initial insert for item 1
    upsertStmt.run(1);
    let row = db.prepare("SELECT item_id, quantity FROM active_cart WHERE item_id = 1").get() as {
      item_id: number;
      quantity: number;
    };
    assert.deepEqual(row, { item_id: 1, quantity: 1 });

    // Subsequent upsert for item 1
    upsertStmt.run(1);
    row = db.prepare("SELECT item_id, quantity FROM active_cart WHERE item_id = 1").get() as {
      item_id: number;
      quantity: number;
    };
    assert.deepEqual(row, { item_id: 1, quantity: 2 });

    // Third upsert for item 1
    upsertStmt.run(1);
    row = db.prepare("SELECT item_id, quantity FROM active_cart WHERE item_id = 1").get() as {
      item_id: number;
      quantity: number;
    };
    assert.deepEqual(row, { item_id: 1, quantity: 3 });

    // Insert item 2
    upsertStmt.run(2);
    const row2 = db.prepare("SELECT item_id, quantity FROM active_cart WHERE item_id = 2").get() as {
      item_id: number;
      quantity: number;
    };
    assert.deepEqual(row2, { item_id: 2, quantity: 1 });
  });

  it("computes cart total correctly matching join with items table", () => {
    const upsertStmt = db.prepare(
      "INSERT INTO active_cart (item_id, quantity) VALUES (?, 1) ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + 1"
    );
    const totalStmt = db.prepare(
      "SELECT SUM(ac.quantity * i.item_price) AS total FROM active_cart ac JOIN items i ON ac.item_id = i.item_id"
    );

    // Empty cart total should be 0
    let totalRow = totalStmt.get() as { total: number | null } | undefined;
    assert.equal(Number(totalRow?.total || 0), 0);

    // Add item 1 (price 25)
    upsertStmt.run(1);
    totalRow = totalStmt.get() as { total: number | null } | undefined;
    assert.equal(Number(totalRow?.total || 0), 25);

    // Add item 1 again (qty 2 * 25 = 50)
    upsertStmt.run(1);
    totalRow = totalStmt.get() as { total: number | null } | undefined;
    assert.equal(Number(totalRow?.total || 0), 50);

    // Add item 2 (qty 1 * 30, total = 80)
    upsertStmt.run(2);
    totalRow = totalStmt.get() as { total: number | null } | undefined;
    assert.equal(Number(totalRow?.total || 0), 80);

    // Add item 3 twice (qty 2 * 10 = 20, total = 100)
    upsertStmt.run(3);
    upsertStmt.run(3);
    totalRow = totalStmt.get() as { total: number | null } | undefined;
    assert.equal(Number(totalRow?.total || 0), 100);
  });

  it("clears cart completely and resets total to 0", () => {
    const upsertStmt = db.prepare(
      "INSERT INTO active_cart (item_id, quantity) VALUES (?, 1) ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + 1"
    );
    const totalStmt = db.prepare(
      "SELECT SUM(ac.quantity * i.item_price) AS total FROM active_cart ac JOIN items i ON ac.item_id = i.item_id"
    );

    upsertStmt.run(1);
    upsertStmt.run(2);

    const countBefore = (db.prepare("SELECT COUNT(*) AS count FROM active_cart").get() as { count: number }).count;
    assert.equal(countBefore, 2);

    // Clear cart
    db.prepare("DELETE FROM active_cart").run();

    const countAfter = (db.prepare("SELECT COUNT(*) AS count FROM active_cart").get() as { count: number }).count;
    assert.equal(countAfter, 0);

    const totalRow = totalStmt.get() as { total: number | null } | undefined;
    assert.equal(Number(totalRow?.total || 0), 0);
  });

  it("deletes cart items on item deletion due to CASCADE constraint", () => {
    db.prepare(
      "INSERT INTO active_cart (item_id, quantity) VALUES (?, 1) ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + 1"
    ).run(1);

    db.prepare("DELETE FROM items WHERE item_id = 1").run();

    const row = db.prepare("SELECT * FROM active_cart WHERE item_id = 1").get();
    assert.equal(row, undefined);
  });
});
