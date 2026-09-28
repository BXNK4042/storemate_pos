import Database from "better-sqlite3";
const db = new Database('app.db')

const create_items = `
  CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRNET_TIMESTAMP
  )
`;

db.exec(create_items);
