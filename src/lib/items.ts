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
