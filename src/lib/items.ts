import getDb from "./db";
import type { Item } from "@/types/item";

export function getItems(): { data: Item[]; error: string | null } {
  try {
    const db = getDb();
    const items = db
      .prepare(
        "SELECT item_id, item_name, item_price, item_amount, item_barcode, item_image FROM items ORDER BY item_id DESC"
      )
      .all() as Item[];
    return { data: items, error: null };
  } catch (err) {
    console.error("Failed to query items:", err);
    return {
      data: [],
      error: err instanceof Error ? err.message : "Failed to load items",
    };
  }
}

export function createItem(item: {
  item_name: string;
  item_price: number;
  item_amount: number;
  item_barcode: string;
  item_image?: string | null;
}): { data: Item | null; error: string | null } {
  try {
    const db = getDb();
    const stmt = db.prepare(
      "INSERT INTO items (item_name, item_price, item_amount, item_barcode, item_image) VALUES (?, ?, ?, ?, ?)"
    );
    const result = stmt.run(
      item.item_name.trim(),
      item.item_price,
      item.item_amount,
      item.item_barcode.trim(),
      item.item_image || null
    );
    const newItem: Item = {
      item_id: Number(result.lastInsertRowid),
      item_name: item.item_name.trim(),
      item_price: item.item_price,
      item_amount: item.item_amount,
      item_barcode: item.item_barcode.trim(),
      item_image: item.item_image || null,
    };
    return { data: newItem, error: null };
  } catch (err) {
    console.error("Failed to insert item:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to create item",
    };
  }
}

export function updateItem(
  id: number,
  item: {
    item_name: string;
    item_price: number;
    item_amount: number;
    item_barcode: string;
    item_image?: string | null;
  }
): { data: Item | null; error: string | null } {
  try {
    const db = getDb();
    const existing = db
      .prepare(
        "SELECT item_id, item_name, item_price, item_amount, item_barcode, item_image FROM items WHERE item_id = ?"
      )
      .get(id) as Item | undefined;

    if (!existing) {
      return { data: null, error: "ไม่พบสินค้าที่ต้องการแก้ไข" };
    }

    const imageToSave =
      item.item_image !== undefined ? item.item_image : existing.item_image;

    const stmt = db.prepare(
      "UPDATE items SET item_name = ?, item_price = ?, item_amount = ?, item_barcode = ?, item_image = ? WHERE item_id = ?"
    );
    stmt.run(
      item.item_name.trim(),
      item.item_price,
      item.item_amount,
      item.item_barcode.trim(),
      imageToSave || null,
      id
    );

    const updatedItem: Item = {
      item_id: id,
      item_name: item.item_name.trim(),
      item_price: item.item_price,
      item_amount: item.item_amount,
      item_barcode: item.item_barcode.trim(),
      item_image: imageToSave || null,
    };
    return { data: updatedItem, error: null };
  } catch (err) {
    console.error("Failed to update item:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to update item",
    };
  }
}

export function deleteItem(id: number): { error: string | null } {
  try {
    const db = getDb();
    db.pragma("foreign_keys = ON");

    const existing = db
      .prepare("SELECT item_id FROM items WHERE item_id = ?")
      .get(id);

    if (!existing) {
      return { error: "ไม่พบสินค้าที่ต้องการลบ" };
    }

    const stmt = db.prepare("DELETE FROM items WHERE item_id = ?");
    stmt.run(id);

    return { error: null };
  } catch (err: unknown) {
    console.error("Failed to delete item:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code;
    if (
      code === "SQLITE_CONSTRAINT_FOREIGNKEY" ||
      code === "SQLITE_CONSTRAINT" ||
      msg.toLowerCase().includes("foreign key")
    ) {
      return {
        error: "ไม่สามารถลบสินค้านี้ได้ เนื่องจากมีประวัติการขายในระบบ (order_items)",
      };
    }
    return {
      error: err instanceof Error ? err.message : "Failed to delete item",
    };
  }
}
