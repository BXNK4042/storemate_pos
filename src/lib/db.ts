import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "backend", "app.db");

declare global {
  var __db: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (process.env.NODE_ENV === "production") {
    const db = new Database(dbPath);
    initTables(db);
    return db;
  }

  if (!global.__db) {
    global.__db = new Database(dbPath);
    initTables(global.__db);
  }

  return global.__db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS active_barcode (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      barcode TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    CREATE INDEX IF NOT EXISTS idx_stock_adjustments_item_id 
      ON stock_adjustments(item_id);

    CREATE INDEX IF NOT EXISTS idx_stock_adjustments_created_at 
      ON stock_adjustments(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_stock_adjustments_reason 
      ON stock_adjustments(reason);

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

  try {
    db.exec(`ALTER TABLE items ADD COLUMN expiry_date TEXT;`);
  } catch {
    // Column already exists or table doesn't exist yet
  }

  try {
    db.exec(`ALTER TABLE items ADD COLUMN low_stock_threshold INTEGER DEFAULT NULL;`);
  } catch {
    // Column already exists or table doesn't exist yet
  }

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_items_low_stock ON items(item_amount, low_stock_threshold);`);
  } catch {
    // Index already exists or table doesn't exist yet
  }

  try {
    db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('stock_default_low_threshold', '5');`).run();
  } catch {
    // Table doesn't exist yet or other failure
  }
}

export default getDb;
