import Database from "better-sqlite3";
const db = new Database('backend/app.db');

db.pragma('foreign_keys = ON');

const insert_items = `
  INSERT INTO items (item_name, item_price, item_amount, item_barcode, item_images)
  VALUES 
    ('Classic Lays', 20, 5, 'abcdefg', '/uploads/items/classic_lays.jpg'),
    ('Coca-Cola 325ml', 15, 20, 'coke325ml', '/uploads/items/coca_cola_325ml.jpg'),
    ('KitKat Bar', 25, 12, 'kitkatbar', '/uploads/items/kitkat_bar.jpg'),
    ('Oishi Green Tea', 20, 10, 'oishitea', '/uploads/items/oishi_green_tea.jpg')
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
