import Database from "better-sqlite3";
const db = new Database('backend/app.db');

db.pragma('foreign_keys = ON');

const insert_items = `
  INSERT INTO items (item_name, item_price, item_amount, item_barcode)
  VALUES 
    ('เลย์ คลาสสิค', 20, 5, 'abcdefg'),
    ('โค้ก 325 มล.', 15, 20, 'coke325ml'),
    ('คิทแคท บาร์', 25, 12, 'kitkatbar'),
    ('ชาเขียวโออิชิ', 20, 10, 'oishitea')
`;

const insert_orders = `
  INSERT INTO orders (order_name, order_price)
  VALUES ('Order #1', 20)
`;

const insert_users = `
  INSERT INTO users (user_name, user_role, user_password)
  VALUES ('admin', 'admin', 'password123')
`;

const insert_order_items = `
  INSERT INTO order_items (order_id, item_id, quantity)
  VALUES (1, 1, 1)
`;

db.exec(insert_items);
db.exec(insert_orders);
db.exec(insert_users);
db.exec(insert_order_items);
