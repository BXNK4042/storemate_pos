import Database from "better-sqlite3";
const db = new Database('backend/app.db');

db.pragma('foreign_keys = ON');

const insert_items = `
  INSERT INTO items (item_name, item_price, item_amount, item_barcode, item_image)
  VALUES 
    ('เลย์ คลาสสิค 50 กรัม', 20, 4, 'abcdefg', '/uploads/items/item-1.jpg'),
    ('โค้ก ออริจินัล 325 มล.', 15, 49, 'coke325ml', '/uploads/items/item-2.jpg'),
    ('คิทแคท เวเฟอร์ช็อกโกแลต', 25, 24, 'kitkatbar', '/uploads/items/item-3.jpg'),
    ('ชาเขียวโออิชิ รสต้นตำรับ', 20, 3, 'oishitea', '/uploads/items/item-4.jpg'),
    ('เป๊ปซี่ แมกซ์ 325 มล.', 16, 27, '885002900101', '/uploads/items/item-5.jpg'),
    ('มาม่า ต้มยำกุ้งน้ำข้น', 7, 44, '885002900107', '/uploads/items/item-6.jpg'),
    ('นมพาสเจอร์ไรส์ เมจิ 200 มล.', 27, 8, '885002900108', '/uploads/items/item-7.jpg'),
    ('แซนด์วิชแฮมชีส ตราซีพี', 35, 6, '885002900109', '/uploads/items/item-8.jpg')
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
