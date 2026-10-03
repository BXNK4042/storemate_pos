import getDb from "./db";

export function getActiveBarcode(): string {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT barcode FROM active_barcode WHERE id = 1")
      .get() as { barcode: string } | undefined;
    return row?.barcode ?? "";
  } catch (err) {
    console.error("Failed to read active barcode:", err);
    return "";
  }
}

export function setActiveBarcode(barcode: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO active_barcode (id, barcode, updated_at)
    VALUES (1, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET barcode = excluded.barcode, updated_at = CURRENT_TIMESTAMP
  `).run(barcode);
}

export function clearActiveBarcode(): void {
  const db = getDb();
  db.prepare("DELETE FROM active_barcode WHERE id = 1").run();
}
