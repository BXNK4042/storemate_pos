const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'app.db');
const db = new Database(dbPath);

console.log('Seeding demo data into', dbPath);

// Run inside a transaction
const seed = db.transaction(() => {
  // 1. Clear existing business data
  db.prepare('DELETE FROM order_items').run();
  db.prepare('DELETE FROM orders').run();
  db.prepare('DELETE FROM stock_adjustments').run();
  db.prepare('DELETE FROM waste_records').run();
  db.prepare('DELETE FROM active_cart').run();
  db.prepare('DELETE FROM items').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('items', 'orders', 'stock_adjustments', 'waste_records')").run();

  // 2. Insert 8 clean demo items
  const insertItem = db.prepare(`
    INSERT INTO items (item_id, item_name, item_price, item_amount, item_barcode, expiry_date, low_stock_threshold)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  const formatYMD = (d) => d.toISOString().split('T')[0];
  const addDays = (d, days) => new Date(d.getTime() + days * 86400000);

  const items = [
    [1, 'เลย์ คลาสสิค 50 กรัม', 20, 4, 'abcdefg', null, 5], // low stock (4 <= 5)
    [2, 'โค้ก ออริจินัล 325 มล.', 15, 36, 'coke325ml', null, null],
    [3, 'คิทแคท เวเฟอร์ช็อกโกแลต', 25, 24, 'kitkatbar', null, null],
    [4, 'ชาเขียวโออิชิ รสต้นตำรับ', 20, 3, 'oishitea', null, 5], // low stock (3 <= 5)
    [5, 'เป๊ปซี่ แมกซ์ 325 มล.', 16, 28, '885002900101', null, null],
    [6, 'มาม่า ต้มยำกุ้งน้ำข้น', 7, 45, '885002900107', null, null],
    [7, 'นมพาสเจอร์ไรส์ เมจิ 200 มล.', 27, 8, '885002900108', formatYMD(addDays(now, 5)), null], // expiring soon
    [8, 'แซนด์วิชแฮมชีส ตราซีพี', 35, 6, '885002900109', formatYMD(addDays(now, 1)), null], // expiring very soon
  ];

  for (const item of items) {
    insertItem.run(...item);
  }

  // 3. Insert 8 realistic orders across the past 4 days and today
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      order_id, order_name, order_price, subtotal, payment_method,
      amount_paid, change_amount, status, discount_type, discount_value,
      discount_amount, promptpay_type, promptpay_ref, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, item_id, quantity, final_price)
    VALUES (?, ?, ?, ?)
  `);

  const formatDateTime = (d) => {
    return d.toISOString().replace('T', ' ').substring(0, 19);
  };

  const ordersData = [
    // 3 days ago
    {
      id: 1,
      name: 'POS-100001',
      total: 35,
      subtotal: 35,
      method: 'cash',
      paid: 50,
      change: 15,
      status: 'completed',
      date: formatDateTime(addDays(now, -3)),
      items: [{ id: 1, qty: 1, price: 20 }, { id: 2, qty: 1, price: 15 }],
    },
    // 2 days ago
    {
      id: 2,
      name: 'POS-100002',
      total: 50,
      subtotal: 50,
      method: 'promptpay',
      paid: 50,
      change: 0,
      status: 'completed',
      pp_type: 'dynamic',
      pp_ref: 'THQR-982341',
      date: formatDateTime(addDays(now, -2)),
      items: [{ id: 3, qty: 2, price: 50 }],
    },
    // Yesterday
    {
      id: 3,
      name: 'POS-100003',
      total: 42,
      subtotal: 42,
      method: 'cash',
      paid: 100,
      change: 58,
      status: 'completed',
      date: formatDateTime(addDays(now, -1)),
      items: [{ id: 7, qty: 1, price: 27 }, { id: 2, qty: 1, price: 15 }],
    },
    {
      id: 4,
      name: 'POS-100004',
      total: 35,
      subtotal: 35,
      method: 'cash',
      paid: 35,
      change: 0,
      status: 'refunded',
      date: formatDateTime(addDays(now, -1)),
      items: [{ id: 8, qty: 1, price: 35 }],
    },
    // Today
    {
      id: 5,
      name: 'POS-100005',
      total: 62,
      subtotal: 62,
      method: 'promptpay',
      paid: 62,
      change: 0,
      status: 'completed',
      pp_type: 'dynamic',
      pp_ref: 'THQR-110294',
      date: formatDateTime(new Date(now.getTime() - 4 * 3600000)),
      items: [{ id: 8, qty: 1, price: 35 }, { id: 7, qty: 1, price: 27 }],
    },
    {
      id: 6,
      name: 'POS-100006',
      total: 36,
      subtotal: 36,
      method: 'cash',
      paid: 50,
      change: 14,
      status: 'completed',
      date: formatDateTime(new Date(now.getTime() - 2 * 3600000)),
      items: [{ id: 1, qty: 1, price: 20 }, { id: 5, qty: 1, price: 16 }],
    },
    {
      id: 7,
      name: 'POS-100007',
      total: 20,
      subtotal: 20,
      method: 'promptpay',
      paid: 20,
      change: 0,
      status: 'completed',
      pp_type: 'static',
      pp_ref: 'THQR-554109',
      date: formatDateTime(new Date(now.getTime() - 1 * 3600000)),
      items: [{ id: 4, qty: 1, price: 20 }],
    },
    {
      id: 8,
      name: 'POS-100008',
      total: 46,
      subtotal: 46,
      method: 'cash',
      paid: 100,
      change: 54,
      status: 'completed',
      date: formatDateTime(new Date(now.getTime() - 30 * 60000)),
      items: [{ id: 5, qty: 1, price: 16 }, { id: 3, qty: 1, price: 25 }, { id: 6, qty: 1, price: 7 }],
    },
  ];

  for (const o of ordersData) {
    insertOrder.run(
      o.id,
      o.name,
      o.total,
      o.subtotal,
      o.method,
      o.paid,
      o.change,
      o.status,
      null,
      0,
      0,
      o.pp_type || null,
      o.pp_ref || null,
      o.date
    );
    for (const it of o.items) {
      insertOrderItem.run(o.id, it.id, it.qty, it.price);
    }
  }

  // 4. Insert 10 clean stock adjustments covering the 3 simplified reasons + sales
  const insertAdj = db.prepare(`
    INSERT INTO stock_adjustments (
      adjustment_id, item_id, change_qty, previous_qty, new_qty,
      reason, reference_id, note, user_id, user_name, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const adjustments = [
    // 1. Initial Restock
    [1, 1, 10, 0, 10, 'restock', 'PO-2026-001', 'รับเข้าสินค้าล็อตแรก', 1, 'admin', formatDateTime(addDays(now, -5))],
    [2, 2, 40, 0, 40, 'restock', 'PO-2026-001', 'รับเข้าสินค้าล็อตแรก', 1, 'admin', formatDateTime(addDays(now, -5))],
    [3, 3, 30, 0, 30, 'restock', 'PO-2026-001', 'รับเข้าสินค้าล็อตแรก', 1, 'admin', formatDateTime(addDays(now, -5))],
    [4, 4, 10, 0, 10, 'restock', 'PO-2026-001', 'รับเข้าสินค้าล็อตแรก', 1, 'admin', formatDateTime(addDays(now, -5))],
    // 2. Sales records
    [5, 1, -1, 10, 9, 'sale', 'ORDER-1', 'ขายสินค้าผ่าน POS (บิล POS-100001)', 2, 'cashier', formatDateTime(addDays(now, -3))],
    [6, 3, -2, 30, 28, 'sale', 'ORDER-2', 'ขายสินค้าผ่าน POS (บิล POS-100002)', 2, 'cashier', formatDateTime(addDays(now, -2))],
    // 3. Damage / Loss record
    [7, 1, -2, 9, 7, 'damage', 'DMG-001', 'สินค้าบรรจุภัณฑ์ชำรุดเสียหาย', 1, 'admin', formatDateTime(addDays(now, -2))],
    // 4. Inventory count correction
    [8, 4, -4, 10, 6, 'inventory_count', 'AUDIT-01', 'ตรวจนับสต็อกประจำสัปดาห์', 1, 'admin', formatDateTime(addDays(now, -1))],
    // 5. Recent Sales today
    [9, 1, -1, 7, 6, 'sale', 'ORDER-6', 'ขายสินค้าผ่าน POS (บิล POS-100006)', 2, 'cashier', formatDateTime(new Date(now.getTime() - 2 * 3600000))],
    [10, 4, -1, 6, 5, 'sale', 'ORDER-7', 'ขายสินค้าผ่าน POS (บิล POS-100007)', 2, 'cashier', formatDateTime(new Date(now.getTime() - 1 * 3600000))],
  ];

  for (const adj of adjustments) {
    insertAdj.run(...adj);
  }

  console.log('Successfully seeded clean demo data!');
});

seed();
db.close();
