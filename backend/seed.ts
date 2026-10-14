import Database from "better-sqlite3";
const db = new Database('backend/app.db');

db.pragma('foreign_keys = ON');

const insert_items = `
  INSERT INTO items (item_name, item_price, item_amount, item_barcode, item_image)
  VALUES 
    ("Lay's Classic 50g", 20, 4, 'abcdefg', '/uploads/items/item-1.jpg'),
    ('Coke Original 325ml', 15, 49, 'coke325ml', '/uploads/items/item-2.jpg'),
    ('KitKat Chocolate Wafer', 25, 24, 'kitkatbar', '/uploads/items/item-3.jpg'),
    ('Oishi Green Tea Original', 20, 3, 'oishitea', '/uploads/items/item-4.jpg'),
    ('Pepsi Max 325ml', 16, 27, '885002900101', '/uploads/items/item-5.jpg'),
    ('Mama Tom Yum Kung Creamy', 7, 44, '885002900107', '/uploads/items/item-6.jpg'),
    ('Meiji Pasteurized Milk 200ml', 27, 8, '885002900108', '/uploads/items/item-7.jpg'),
    ('CP Ham & Cheese Sandwich', 35, 6, '885002900109', '/uploads/items/item-8.jpg')
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
