import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { POST, GET, PUT, DELETE } from "@/app/api/data/route";

const DEFAULT_KEY = "pos-scan-key-3849fbc281e047da";

function setupDatabase() {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");

  // Create core schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      item_price INTEGER NOT NULL,
      item_amount INTEGER NOT NULL,
      item_barcode TEXT NOT NULL UNIQUE,
      expiry_date TEXT,
      low_stock_threshold INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      user_password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      order_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_name TEXT NOT NULL,
      order_price INTEGER NOT NULL,
      subtotal REAL DEFAULT 0,
      discount_type TEXT,
      discount_value REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      amount_paid REAL DEFAULT 0,
      change_amount REAL DEFAULT 0,
      promptpay_type TEXT,
      promptpay_ref TEXT,
      promptpay_payload TEXT,
      status TEXT DEFAULT 'completed',
      refund_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      order_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      discount_type TEXT,
      discount_value REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      final_price REAL DEFAULT 0,
      PRIMARY KEY (order_id, item_id),
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(item_id)
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

    CREATE TABLE IF NOT EXISTS active_cart (
      item_id INTEGER NOT NULL,
      mode TEXT NOT NULL DEFAULT 'sale',
      quantity INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (item_id, mode),
      FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE
    );

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
  `);

  // Seed sample items
  db.prepare(`
    INSERT INTO items (item_id, item_name, item_price, item_amount, item_barcode)
    VALUES (1, 'Green Tea 500ml', 25, 10, '8850000001')
  `).run();

  db.prepare(`
    INSERT INTO items (item_id, item_name, item_price, item_amount, item_barcode)
    VALUES (2, 'Potato Chips 50g', 30, 20, '8850000002')
  `).run();

  db.prepare(`
    INSERT INTO items (item_id, item_name, item_price, item_amount, item_barcode)
    VALUES (3, 'Mineral Water', 10, 5, '8850000003')
  `).run();

  (global as any).__db = db;
  return db;
}

function createRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
}): Request {
  const url = options.url || "http://localhost:3000/api/data";
  const headers = new Headers(options.headers || {});
  if (!headers.has("x-api-key")) {
    headers.set("x-api-key", DEFAULT_KEY);
  }
  if (options.body) {
    headers.set("content-type", "application/json");
  }

  return new Request(url, {
    method: options.method || "POST",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

describe("ESP32 StoreMate POS API (/api/data)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupDatabase();
  });

  describe("Authentication", () => {
    it("rejects unauthenticated request with 401 and success: false", async () => {
      const req = new Request("http://localhost:3000/api/data", {
        method: "POST",
        headers: {},
        body: JSON.stringify({ barcode: "8850000001" }),
      });

      const res = await POST(req);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.error, "Unauthorized");
    });

    it("accepts request with default x-api-key", async () => {
      const req = createRequest({
        body: { barcode: "8850000001" },
      });

      const res = await POST(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
    });

    it("accepts request with custom env SCANNER_API_KEY", async () => {
      process.env.SCANNER_API_KEY = "custom-secret-key-123";
      try {
        const req = new Request("http://localhost:3000/api/data", {
          method: "POST",
          headers: { "x-api-key": "custom-secret-key-123", "content-type": "application/json" },
          body: JSON.stringify({ barcode: "8850000001" }),
        });
        const res = await POST(req);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
      } finally {
        delete process.env.SCANNER_API_KEY;
      }
    });
  });

  describe("Action: scan & Backward Compatibility", () => {
    it("scans item using body.text (legacy fallback) and defaults action='scan' & mode='sale'", async () => {
      const req = createRequest({
        body: { text: "8850000001" },
      });

      const res = await POST(req);
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.success, true);
      assert.equal(data.name, "Green Tea 500ml");
      assert.equal(data.price, 25);
      assert.equal(data.barcode, "8850000001");
      assert.equal(data.total, 25);
      assert.equal(data.total_quantity, 1);
      assert.equal(data.items.length, 1);
      assert.equal(data.items[0].barcode, "8850000001");
      assert.equal(data.items[0].quantity, 1);
    });

    it("scans item using body.barcode with action='scan'", async () => {
      const req = createRequest({
        body: { action: "scan", barcode: "8850000002" },
      });

      const res = await POST(req);
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.success, true);
      assert.equal(data.name, "Potato Chips 50g");
      assert.equal(data.price, 30);
      assert.equal(data.barcode, "8850000002");
      assert.equal(data.total, 30);
      assert.equal(data.total_quantity, 1);
    });

    it("upserts quantity on repeated scan and places latest item at the end of items array", async () => {
      // Scan item 1
      await POST(createRequest({ body: { barcode: "8850000001" } }));
      // Scan item 2
      await POST(createRequest({ body: { barcode: "8850000002" } }));
      // Re-scan item 1
      const res = await POST(createRequest({ body: { barcode: "8850000001" } }));

      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.total, 80); // (2 * 25) + (1 * 30) = 80
      assert.equal(data.total_quantity, 3);
      assert.equal(data.items.length, 2);

      // Most recently updated item (item 1) should be at the end of items
      assert.equal(data.items[data.items.length - 1].item_id, 1);
      assert.equal(data.items[data.items.length - 1].quantity, 2);
    });

    it("isolates carts between mode='sale' and mode='stock'", async () => {
      await POST(createRequest({ body: { mode: "sale", barcode: "8850000001" } }));
      await POST(createRequest({ body: { mode: "stock", barcode: "8850000002" } }));

      const resSale = await GET(createRequest({ method: "GET", url: "http://localhost:3000/api/data?mode=sale" }));
      const saleData = await resSale.json();
      assert.equal(saleData.items.length, 1);
      assert.equal(saleData.items[0].barcode, "8850000001");

      const resStock = await GET(createRequest({ method: "GET", url: "http://localhost:3000/api/data?mode=stock" }));
      const stockData = await resStock.json();
      assert.equal(stockData.items.length, 1);
      assert.equal(stockData.items[0].barcode, "8850000002");
    });

    it("returns 404 with preserved session cart when barcode is not found", async () => {
      // First scan valid item
      await POST(createRequest({ body: { barcode: "8850000001" } }));

      // Now scan non-existent item
      const res = await POST(createRequest({ body: { barcode: "UNKNOWN_999" } }));
      assert.equal(res.status, 404);
      const data = await res.json();

      assert.equal(data.success, false);
      assert.equal(data.error, "Item not found");
      assert.equal(data.barcode, "UNKNOWN_999");
      assert.equal(data.total, 25);
      assert.equal(data.total_quantity, 1);
      assert.equal(data.items.length, 1);
      assert.equal(data.items[0].barcode, "8850000001");
    });
  });

  describe("Action: update_qty", () => {
    it("updates quantity by barcode", async () => {
      await POST(createRequest({ body: { barcode: "8850000001" } }));

      const res = await POST(createRequest({
        body: { action: "update_qty", barcode: "8850000001", quantity: 3 }
      }));

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.total_quantity, 4); // 1 + 3
      assert.equal(data.total, 100); // 4 * 25
      assert.equal(data.items[0].quantity, 4);
    });

    it("updates latest item quantity when barcode is empty or not provided", async () => {
      await POST(createRequest({ body: { barcode: "8850000001" } }));
      await POST(createRequest({ body: { barcode: "8850000002" } }));

      // Latest item is item 2 (Chips)
      const res = await POST(createRequest({
        body: { action: "update_qty", quantity: 2 }
      }));

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      const chipsItem = data.items.find((i: any) => i.item_id === 2);
      assert.equal(chipsItem.quantity, 3); // 1 + 2
    });

    it("removes item if resulting quantity is <= 0", async () => {
      await POST(createRequest({ body: { barcode: "8850000001" } }));

      const res = await POST(createRequest({
        body: { action: "update_qty", barcode: "8850000001", quantity: -1 }
      }));

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.total_quantity, 0);
      assert.equal(data.items.length, 0);
    });
  });

  describe("Action: delete", () => {
    it("decrements quantity by default 1 when quantity is not specified", async () => {
      await POST(createRequest({ body: { barcode: "8850000001" } }));
      await POST(createRequest({ body: { barcode: "8850000001" } })); // qty = 2

      const res = await POST(createRequest({
        body: { action: "delete", barcode: "8850000001" }
      }));

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.total_quantity, 1);
      assert.equal(data.items[0].quantity, 1);
    });

    it("deletes latest item when barcode is empty", async () => {
      await POST(createRequest({ body: { barcode: "8850000001" } }));
      await POST(createRequest({ body: { barcode: "8850000002" } }));

      // Delete latest item (Chips, qty 1)
      const res = await POST(createRequest({
        body: { action: "delete" }
      }));

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.items.length, 1);
      assert.equal(data.items[0].barcode, "8850000001");
    });
  });

  describe("Action: commit_stock_in", () => {
    it("fails when cart is empty", async () => {
      const res = await POST(createRequest({
        body: { action: "commit_stock_in" }
      }));
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.error, "Cart is empty");
    });

    it("increments stock, inserts audit log with reason 'restock', and clears stock cart", async () => {
      // Item 2 initial amount: 20
      await POST(createRequest({ body: { action: "scan", mode: "stock", barcode: "8850000002" } }));
      await POST(createRequest({ body: { action: "scan", mode: "stock", barcode: "8850000002" } }));
      await POST(createRequest({ body: { action: "scan", mode: "stock", barcode: "8850000002" } })); // qty 3

      const res = await POST(createRequest({
        body: { action: "commit_stock_in" }
      }));

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.mode, "stock");
      assert.equal(data.message, "Stock intake committed successfully");
      assert.equal(data.count, 1);
      assert.equal(data.total_quantity, 3);

      // Check active_cart cleared for mode 'stock'
      const cartRows = db.prepare("SELECT * FROM active_cart WHERE mode = 'stock'").all();
      assert.equal(cartRows.length, 0);

      // Check item amount incremented (20 + 3 = 23)
      const item = db.prepare("SELECT item_amount FROM items WHERE item_id = 2").get() as any;
      assert.equal(item.item_amount, 23);

      // Check audit log
      const adj = db.prepare("SELECT * FROM stock_adjustments WHERE item_id = 2 AND reason = 'restock' ORDER BY adjustment_id DESC").get() as any;
      assert.ok(adj);
      assert.equal(adj.change_qty, 3);
      assert.equal(adj.previous_qty, 20);
      assert.equal(adj.new_qty, 23);
      assert.equal(adj.note, "Manual Stock Intake");
    });
  });

  describe("Removal of action: confirm", () => {
    it("returns 400 Unknown action for legacy confirm", async () => {
      const res = await POST(createRequest({
        body: { action: "confirm", mode: "sale" }
      }));
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.equal(data.error, "Unknown action: confirm");
    });
  });

  describe("Action: total_sales", () => {
    it("returns today's completed total sales", async () => {
      // Initial sales should be 0
      let res = await POST(createRequest({
        body: { action: "total_sales" }
      }));
      assert.equal(res.status, 200);
      let data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.total_sales, 0);
      assert.equal(data.total, 0);

      // Insert an order for today
      db.prepare(`
        INSERT INTO orders (order_name, order_price, status, created_at)
        VALUES ('TEST-ORDER-1', 150, 'completed', CURRENT_TIMESTAMP)
      `).run();

      // Insert another order
      db.prepare(`
        INSERT INTO orders (order_name, order_price, status, created_at)
        VALUES ('TEST-ORDER-2', 250, 'completed', CURRENT_TIMESTAMP)
      `).run();

      // Insert refunded order (should be excluded)
      db.prepare(`
        INSERT INTO orders (order_name, order_price, status, created_at)
        VALUES ('TEST-ORDER-REFUNDED', 500, 'refunded', CURRENT_TIMESTAMP)
      `).run();

      res = await POST(createRequest({
        body: { action: "total_sales" }
      }));
      assert.equal(res.status, 200);
      data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.total_sales, 400); // 150 + 250
      assert.equal(data.total, 400);
    });
  });

  describe("GET, PUT, DELETE endpoints compatibility", () => {
    it("GET returns current session cart and active barcode", async () => {
      await POST(createRequest({ body: { barcode: "8850000001" } }));

      const res = await GET(createRequest({ method: "GET" }));
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.text, "8850000001");
      assert.equal(data.total, 25);
      assert.equal(data.items.length, 1);
    });

    it("PUT bulk replaces active cart items", async () => {
      const res = await PUT(createRequest({
        method: "PUT",
        body: {
          items: [
            { item_id: 1, quantity: 2 },
            { item_id: 2, quantity: 1 }
          ]
        }
      }));

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.total, 80); // (2*25) + (1*30)
      assert.equal(data.total_quantity, 3);
    });

    it("DELETE clears cart and active barcode", async () => {
      await POST(createRequest({ body: { barcode: "8850000001" } }));

      const res = await DELETE(createRequest({
        method: "DELETE",
        url: "http://localhost:3000/api/data?clear_cart=true"
      }));

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      const cartRows = db.prepare("SELECT * FROM active_cart").all();
      assert.equal(cartRows.length, 0);
    });
  });
});
