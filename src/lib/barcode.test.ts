import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  getActiveBarcode,
  setActiveBarcode,
  clearActiveBarcode,
  enqueueBarcode,
  popBarcode,
  popActiveBarcode,
} from "./barcode";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      item_price INTEGER NOT NULL,
      item_amount INTEGER NOT NULL,
      item_barcode TEXT NOT NULL UNIQUE,
      expiry_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS active_barcode (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      barcode TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS barcode_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_barcode_queue_status ON barcode_queue(status, id ASC);

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
    VALUES (2, 'Potato Chips 50g', 30, 15, '8850000002')
  `).run();

  db.prepare(`
    INSERT INTO items (item_id, item_name, item_price, item_amount, item_barcode)
    VALUES (3, 'Mineral Water 600ml', 10, 50, '8850000003')
  `).run();

  return db;
}

// Simulates the backend POST /api/data transaction logic with FIFO queue
function processBarcodeScan(db: Database.Database, barcode: string): {
  success: boolean;
  status: number;
  item?: { item_id: number; item_name: string; item_price: number; item_barcode: string };
  error?: string;
} {
  const trimmed = barcode ? barcode.trim() : "";
  if (!trimmed) {
    return { success: false, status: 400, error: "Invalid text" };
  }

  const item = db
    .prepare("SELECT item_id, item_name, item_price, item_barcode FROM items WHERE item_barcode = ?")
    .get(trimmed) as { item_id: number; item_name: string; item_price: number; item_barcode: string } | undefined;

  if (!item) {
    return { success: false, status: 404, error: "Item not found" };
  }

  enqueueBarcode(trimmed, db);

  db.prepare(
    "INSERT INTO active_cart (item_id, quantity) VALUES (?, 1) ON CONFLICT(item_id) DO UPDATE SET quantity = quantity + 1"
  ).run(item.item_id);

  return { success: true, status: 200, item };
}

describe("Barcode Subsystem Diagnostics & Tests", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    // Also point global.__db to our test db so default calls without explicit db work seamlessly
    (global as any).__db = db;
  });

  describe("1. Basic set, get, and clear active barcode (legacy compatibility)", () => {
    it("returns empty string when active_barcode table has no record", () => {
      const barcode = getActiveBarcode(db);
      assert.equal(barcode, "");
    });

    it("successfully sets and retrieves an active barcode", () => {
      setActiveBarcode("8850000001", db);
      const barcode = getActiveBarcode(db);
      assert.equal(barcode, "8850000001");
    });

    it("clears the active barcode successfully", () => {
      setActiveBarcode("8850000001", db);
      assert.equal(getActiveBarcode(db), "8850000001");

      clearActiveBarcode(db);
      assert.equal(getActiveBarcode(db), "");

      const row = db.prepare("SELECT * FROM active_barcode WHERE id = 1").get();
      assert.equal(row, undefined);
    });

    it("repeatedly clearing active barcode is idempotent and safe", () => {
      clearActiveBarcode(db);
      clearActiveBarcode(db);
      assert.equal(getActiveBarcode(db), "");
    });

    it("updates existing barcode and records updated timestamp", () => {
      setActiveBarcode("8850000001", db);
      const row1 = db.prepare("SELECT * FROM active_barcode WHERE id = 1").get() as any;
      assert.equal(row1.barcode, "8850000001");

      setActiveBarcode("8850000002", db);
      const row2 = db.prepare("SELECT * FROM active_barcode WHERE id = 1").get() as any;
      assert.equal(row2.barcode, "8850000002");

      const count = db.prepare("SELECT COUNT(*) as count FROM active_barcode").get() as any;
      assert.equal(count.count, 1);
    });

    it("works via global.__db fallback when no db argument is provided", () => {
      setActiveBarcode("8850000003");
      assert.equal(getActiveBarcode(), "8850000003");
      clearActiveBarcode();
      assert.equal(getActiveBarcode(), "");
    });
  });

  describe("2. FIFO Barcode Queue & Zero Scan Loss", () => {
    it("enqueues barcodes with status='pending' and trims whitespace", () => {
      const id = enqueueBarcode("  8850000001  ", db);
      assert.ok(id > 0);

      const row = db.prepare("SELECT * FROM barcode_queue WHERE id = ?").get(id) as any;
      assert.equal(row.barcode, "8850000001");
      assert.equal(row.status, "pending");
    });

    it("retrieves barcodes in strict FIFO order via popBarcode and popActiveBarcode", () => {
      enqueueBarcode("8850000001", db);
      enqueueBarcode("8850000002", db);
      enqueueBarcode("8850000003", db);

      assert.equal(popBarcode(db), "8850000001");
      assert.equal(popActiveBarcode(db), "8850000002");
      assert.equal(popBarcode(db), "8850000003");
      assert.equal(popBarcode(db), "");
    });

    it("rapid consecutive scans are all preserved in FIFO order with zero loss", () => {
      // Producer scans Tea, then Chips, then Water rapidly before consumer polls
      const res1 = processBarcodeScan(db, "8850000001");
      const res2 = processBarcodeScan(db, "8850000002");
      const res3 = processBarcodeScan(db, "8850000003");

      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);
      assert.equal(res3.status, 200);

      // In the new FIFO queue: ALL scans are preserved without any loss!
      const polled1 = popBarcode(db);
      const polled2 = popBarcode(db);
      const polled3 = popBarcode(db);

      assert.equal(polled1, "8850000001");
      assert.equal(polled2, "8850000002");
      assert.equal(polled3, "8850000003");

      // Zero scan loss: all 3 scans were retrieved
      assert.equal(popBarcode(db), "");
    });

    it("peek via getActiveBarcode returns oldest pending without consuming it", () => {
      enqueueBarcode("8850000001", db);
      enqueueBarcode("8850000002", db);

      // Multiple peeks return the oldest item
      assert.equal(getActiveBarcode(db), "8850000001");
      assert.equal(getActiveBarcode(db), "8850000001");

      // Now popping consumes it
      assert.equal(popBarcode(db), "8850000001");
      assert.equal(getActiveBarcode(db), "8850000002");
      assert.equal(popBarcode(db), "8850000002");
      assert.equal(getActiveBarcode(db), "");
    });

    it("clearActiveBarcode marks all pending queue entries as consumed", () => {
      enqueueBarcode("8850000001", db);
      enqueueBarcode("8850000002", db);

      clearActiveBarcode(db);

      // Queue is now drained
      assert.equal(popBarcode(db), "");
      assert.equal(getActiveBarcode(db), "");

      const pendingCount = db
        .prepare("SELECT COUNT(*) as count FROM barcode_queue WHERE status = 'pending'")
        .get() as any;
      assert.equal(pendingCount.count, 0);
    });
  });

  describe("3. Atomic Pop & Zero Duplicate Reads", () => {
    it("atomic pop eliminates duplicate reads across consecutive calls", () => {
      processBarcodeScan(db, "8850000001");

      // First poll receives the barcode
      const poll1 = popBarcode(db);
      assert.equal(poll1, "8850000001");

      // Subsequent polls receive empty string (zero duplicates)
      const poll2 = popBarcode(db);
      assert.equal(poll2, "");
      const poll3 = popBarcode(db);
      assert.equal(poll3, "");
    });

    it("multiple consumers concurrently popping queue receive distinct scans with zero duplicates", () => {
      enqueueBarcode("8850000001", db);
      enqueueBarcode("8850000002", db);

      // Consumer A polls
      const consumerARead = popBarcode(db);
      // Consumer B polls
      const consumerBRead = popBarcode(db);

      assert.equal(consumerARead, "8850000001");
      assert.equal(consumerBRead, "8850000002");
      assert.notEqual(consumerARead, consumerBRead);
    });

    it("late incoming scan between pops is never lost", () => {
      // Scan 1 arrives and is popped
      processBarcodeScan(db, "8850000001");
      assert.equal(popBarcode(db), "8850000001");

      // Scan 2 arrives
      processBarcodeScan(db, "8850000002");

      // Client clears active slot or polls
      assert.equal(popBarcode(db), "8850000002");
    });
  });

  describe("4. Concurrent cart upsert and barcode state consistency", () => {
    it("active_cart quantity accumulates correctly while active_barcode and queue are tracked", () => {
      processBarcodeScan(db, "8850000001");
      processBarcodeScan(db, "8850000001");
      processBarcodeScan(db, "8850000001");

      const cartRow = db.prepare("SELECT quantity FROM active_cart WHERE item_id = 1").get() as any;
      assert.equal(cartRow.quantity, 3);

      // Queue has all 3 scans ready to be processed in order
      assert.equal(popBarcode(db), "8850000001");
      assert.equal(popBarcode(db), "8850000001");
      assert.equal(popBarcode(db), "8850000001");
      assert.equal(popBarcode(db), "");
    });

    it("active_cart and barcode queue remain fully consistent across multiple distinct items", () => {
      processBarcodeScan(db, "8850000001");
      processBarcodeScan(db, "8850000002");
      processBarcodeScan(db, "8850000003");

      const cartItems = db.prepare("SELECT * FROM active_cart ORDER BY item_id ASC").all() as any[];
      assert.equal(cartItems.length, 3);
      assert.equal(cartItems[0].item_id, 1);
      assert.equal(cartItems[1].item_id, 2);
      assert.equal(cartItems[2].item_id, 3);

      const totalRow = db.prepare(
        "SELECT SUM(ac.quantity * i.item_price) AS total FROM active_cart ac JOIN items i ON ac.item_id = i.item_id"
      ).get() as any;
      assert.equal(totalRow.total, 65);

      // FIFO queue retrieves each scanned barcode in exact order
      assert.equal(popBarcode(db), "8850000001");
      assert.equal(popBarcode(db), "8850000002");
      assert.equal(popBarcode(db), "8850000003");
    });

    it("maintains cart integrity during simultaneous clearActiveBarcode and cart updates", () => {
      processBarcodeScan(db, "8850000001");
      processBarcodeScan(db, "8850000002");

      clearActiveBarcode(db);

      assert.equal(popBarcode(db), "");
      assert.equal(getActiveBarcode(db), "");

      const cartCount = db.prepare("SELECT COUNT(*) as count FROM active_cart").get() as any;
      assert.equal(cartCount.count, 2);
    });
  });

  describe("5. Unknown barcode and edge cases", () => {
    it("handles unknown/unregistered barcode: returns 404 and does not alter barcode queue or cart", () => {
      const res = processBarcodeScan(db, "9999999999");
      assert.equal(res.status, 404);
      assert.equal(res.success, false);
      assert.equal(res.error, "Item not found");

      assert.equal(popBarcode(db), "");
      assert.equal(getActiveBarcode(db), "");

      const cartCount = db.prepare("SELECT COUNT(*) as count FROM active_cart").get() as any;
      assert.equal(cartCount.count, 0);
    });

    it("handles empty barcode string properly", () => {
      setActiveBarcode("", db);
      assert.equal(getActiveBarcode(db), "");
      const res = processBarcodeScan(db, "   ");
      assert.equal(res.status, 400);
    });

    it("handles special characters and long barcode strings safely", () => {
      const longBarcode = "BC-" + "X".repeat(250) + "-#$@&!?";
      enqueueBarcode(longBarcode, db);
      assert.equal(popBarcode(db), longBarcode);

      clearActiveBarcode(db);
      assert.equal(popBarcode(db), "");
    });

    it("handles unicode and Thai characters in barcode", () => {
      const thaiBarcode = "บาร์โค้ด-8850000001-ชาเขียว";
      enqueueBarcode(thaiBarcode, db);
      assert.equal(popBarcode(db), thaiBarcode);
    });

    it("gracefully catches database errors and returns empty string instead of throwing", () => {
      const brokenDb = new Database(":memory:");
      const originalConsoleError = console.error;
      console.error = () => {};
      try {
        const barcode = getActiveBarcode(brokenDb);
        assert.equal(barcode, "");
        const popped = popBarcode(brokenDb);
        assert.equal(popped, "");
      } finally {
        console.error = originalConsoleError;
      }
    });
  });
});
