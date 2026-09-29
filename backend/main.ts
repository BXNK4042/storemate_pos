import Database from "better-sqlite3";
const db = new Database('backend/app.db')

const create_items = `
  CREATE TABLE IF NOT EXISTS items (
      item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      item_price INTEGER NOT NULL,
      item_amount INTEGER NOT NULL,
      item_barcode TEXT NOT NULL,
      item_images TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const create_orders = `
  CREATE TABLE IF NOT EXISTS orders (
      order_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_name TEXT NOT NULL,
      order_price INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const create_users = `
  CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      user_password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const create_order_items = `
  CREATE TABLE IF NOT EXISTS order_items (
      order_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      PRIMARY KEY (order_id, item_id),
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(item_id)
  );
`;

db.pragma('foreign_keys = ON');
db.exec(create_items);
db.exec(create_orders);
db.exec(create_users);
db.exec(create_order_items);
