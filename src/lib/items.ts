import getDb from "./db";
import type { Item } from "@/types/item";
import { recordStockAdjustmentEntry } from "./stock";
import type { StockAdjustmentReason } from "@/types/stock";

export function getItems(): { data: Item[]; error: string | null } {
  try {
    const db = getDb();
    const items = db
      .prepare(
        "SELECT item_id, item_name, item_price, item_amount, item_barcode, item_image, expiry_date, low_stock_threshold FROM items ORDER BY item_id DESC"
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
  expiry_date?: string | null;
  low_stock_threshold?: number | null;
  user_id?: number | null;
  user_name?: string | null;
}): { data: Item | null; error: string | null } {
  try {
    const db = getDb();
    const tx = db.transaction(() => {
      const parsedThreshold =
        item.low_stock_threshold !== undefined &&
        item.low_stock_threshold !== null &&
        !isNaN(Number(item.low_stock_threshold)) &&
        Number(item.low_stock_threshold) > 0
          ? Math.floor(Number(item.low_stock_threshold))
          : null;

      const stmt = db.prepare(
        "INSERT INTO items (item_name, item_price, item_amount, item_barcode, item_image, expiry_date, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?)"
      );
      const result = stmt.run(
        item.item_name.trim(),
        item.item_price,
        item.item_amount,
        item.item_barcode.trim(),
        item.item_image || null,
        item.expiry_date ? item.expiry_date.trim() : null,
        parsedThreshold
      );
      const itemId = Number(result.lastInsertRowid);

      if (item.item_amount > 0) {
        recordStockAdjustmentEntry(db, {
          item_id: itemId,
          change_qty: item.item_amount,
          previous_qty: 0,
          new_qty: item.item_amount,
          reason: "initial",
          reference_id: null,
          note: "สต็อกเริ่มต้นสินค้า",
          user_id: item.user_id || null,
          user_name: item.user_name || null,
        });
      }

      const newItem: Item = {
        item_id: itemId,
        item_name: item.item_name.trim(),
        item_price: item.item_price,
        item_amount: item.item_amount,
        item_barcode: item.item_barcode.trim(),
        item_image: item.item_image || null,
        expiry_date: item.expiry_date ? item.expiry_date.trim() : null,
        low_stock_threshold: parsedThreshold,
      };
      return newItem;
    });

    const newItem = tx();
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
    expiry_date?: string | null;
    low_stock_threshold?: number | null;
    reason?: StockAdjustmentReason;
    note?: string | null;
    user_id?: number | null;
    user_name?: string | null;
  }
): { data: Item | null; error: string | null } {
  try {
    const db = getDb();
    const tx = db.transaction(() => {
      const existing = db
        .prepare(
          "SELECT item_id, item_name, item_price, item_amount, item_barcode, item_image, expiry_date, low_stock_threshold FROM items WHERE item_id = ?"
        )
        .get(id) as Item | undefined;

      if (!existing) {
        throw new Error("ไม่พบสินค้าที่ต้องการแก้ไข");
      }

      const imageToSave =
        item.item_image !== undefined ? item.item_image : existing.item_image;
      const expiryToSave =
        item.expiry_date !== undefined
          ? item.expiry_date ? item.expiry_date.trim() : null
          : existing.expiry_date;
      const thresholdToSave =
        item.low_stock_threshold !== undefined
          ? item.low_stock_threshold !== null &&
            !isNaN(Number(item.low_stock_threshold)) &&
            Number(item.low_stock_threshold) > 0
            ? Math.floor(Number(item.low_stock_threshold))
            : null
          : existing.low_stock_threshold ?? null;

      const stmt = db.prepare(
        "UPDATE items SET item_name = ?, item_price = ?, item_amount = ?, item_barcode = ?, item_image = ?, expiry_date = ?, low_stock_threshold = ? WHERE item_id = ?"
      );
      stmt.run(
        item.item_name.trim(),
        item.item_price,
        item.item_amount,
        item.item_barcode.trim(),
        imageToSave || null,
        expiryToSave || null,
        thresholdToSave,
        id
      );

      if (item.item_amount !== existing.item_amount) {
        const delta = item.item_amount - existing.item_amount;
        recordStockAdjustmentEntry(db, {
          item_id: id,
          change_qty: delta,
          previous_qty: existing.item_amount,
          new_qty: item.item_amount,
          reason: item.reason || "correction",
          reference_id: null,
          note: item.note ? item.note.trim() : "แก้ไขสต็อกผ่านฟอร์มสินค้า",
          user_id: item.user_id || null,
          user_name: item.user_name || null,
        });
      }

      const updatedItem: Item = {
        item_id: id,
        item_name: item.item_name.trim(),
        item_price: item.item_price,
        item_amount: item.item_amount,
        item_barcode: item.item_barcode.trim(),
        item_image: imageToSave || null,
        expiry_date: expiryToSave || null,
        low_stock_threshold: thresholdToSave,
      };
      return updatedItem;
    });

    const updatedItem = tx();
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
