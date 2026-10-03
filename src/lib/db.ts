import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "backend", "app.db");

declare global {
  // eslint-disable-next-line no-var
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
  `);
}

export default getDb;
