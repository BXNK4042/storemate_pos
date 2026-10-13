import getDb from "./db";
import type Database from "better-sqlite3";

export function enqueueBarcode(barcode: string, db?: Database.Database): number {
  const trimmed = typeof barcode === "string" ? barcode.trim() : "";
  if (!trimmed) {
    return 0;
  }

  const dbInstance = db ?? getDb();
  let insertId = 0;

  const tx = dbInstance.transaction(() => {
    let queueExists = false;
    try {
      const stmt = dbInstance.prepare(`
        INSERT INTO barcode_queue (barcode, status, created_at)
        VALUES (?, 'pending', CURRENT_TIMESTAMP)
      `);
      const info = stmt.run(trimmed);
      insertId = Number(info.lastInsertRowid);
      queueExists = true;
    } catch {
      // Table barcode_queue might not exist in non-migrated DB
    }

    if (queueExists) {
      // Update active_barcode (id=1) with oldest pending item for legacy readers
      try {
        const oldest = dbInstance
          .prepare(
            "SELECT barcode FROM barcode_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1"
          )
          .get() as { barcode: string } | undefined;

        if (oldest?.barcode) {
          dbInstance.prepare(`
            INSERT INTO active_barcode (id, barcode, updated_at)
            VALUES (1, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET barcode = excluded.barcode, updated_at = CURRENT_TIMESTAMP
          `).run(oldest.barcode);
        }
      } catch {}
    } else {
      // Fallback: update active_barcode directly
      try {
        dbInstance.prepare(`
          INSERT INTO active_barcode (id, barcode, updated_at)
          VALUES (1, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET barcode = excluded.barcode, updated_at = CURRENT_TIMESTAMP
        `).run(trimmed);
      } catch {}
    }
  });

  tx();
  return insertId;
}

export function popBarcode(db?: Database.Database): string {
  try {
    const dbInstance = db ?? getDb();
    const tx = dbInstance.transaction(() => {
      let queueTableExists = true;
      let oldestRow: { id: number; barcode: string } | undefined;

      try {
        oldestRow = dbInstance
          .prepare(
            "SELECT id, barcode FROM barcode_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1"
          )
          .get() as { id: number; barcode: string } | undefined;
      } catch {
        queueTableExists = false;
      }

      if (queueTableExists) {
        if (!oldestRow) {
          // Queue exists and is empty: clear active_barcode and do NOT fallback to it
          try {
            dbInstance.prepare("DELETE FROM active_barcode WHERE id = 1").run();
          } catch {}
          return "";
        }

        // Mark popped item as consumed
        dbInstance
          .prepare("UPDATE barcode_queue SET status = 'consumed' WHERE id = ?")
          .run(oldestRow.id);

        // Update active_barcode with the next pending item, or delete if no pending left
        try {
          const nextRow = dbInstance
            .prepare(
              "SELECT barcode FROM barcode_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1"
            )
            .get() as { barcode: string } | undefined;

          if (nextRow?.barcode) {
            dbInstance.prepare(`
              INSERT INTO active_barcode (id, barcode, updated_at)
              VALUES (1, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET barcode = excluded.barcode, updated_at = CURRENT_TIMESTAMP
            `).run(nextRow.barcode);
          } else {
            dbInstance.prepare("DELETE FROM active_barcode WHERE id = 1").run();
          }
        } catch {}

        return oldestRow.barcode;
      }

      // Fallback: only if barcode_queue table does NOT exist
      try {
        const legacyRow = dbInstance
          .prepare("SELECT barcode FROM active_barcode WHERE id = 1")
          .get() as { barcode: string } | undefined;
        if (legacyRow?.barcode) {
          dbInstance.prepare("DELETE FROM active_barcode WHERE id = 1").run();
          return legacyRow.barcode;
        }
      } catch {}

      return "";
    });

    return tx();
  } catch (err) {
    console.error("Failed to pop barcode:", err);
    return "";
  }
}

export const popActiveBarcode = popBarcode;

export function getActiveBarcode(db?: Database.Database): string {
  try {
    const dbInstance = db ?? getDb();
    let queueTableExists = true;
    let queueRow: { barcode: string } | undefined;

    try {
      queueRow = dbInstance
        .prepare(
          "SELECT barcode FROM barcode_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1"
        )
        .get() as { barcode: string } | undefined;
    } catch {
      queueTableExists = false;
    }

    if (queueTableExists) {
      return queueRow?.barcode ?? "";
    }

    // Fallback: only if barcode_queue table does NOT exist
    const row = dbInstance
      .prepare("SELECT barcode FROM active_barcode WHERE id = 1")
      .get() as { barcode: string } | undefined;
    return row?.barcode ?? "";
  } catch (err) {
    console.error("Failed to read active barcode:", err);
    return "";
  }
}

export function setActiveBarcode(barcode: string, db?: Database.Database): void {
  const dbInstance = db ?? getDb();
  const tx = dbInstance.transaction(() => {
    try {
      dbInstance.prepare(`
        INSERT INTO active_barcode (id, barcode, updated_at)
        VALUES (1, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET barcode = excluded.barcode, updated_at = CURRENT_TIMESTAMP
      `).run(barcode);
    } catch {}

    const trimmed = typeof barcode === "string" ? barcode.trim() : "";
    try {
      dbInstance.prepare("UPDATE barcode_queue SET status = 'consumed' WHERE status = 'pending'").run();
      if (trimmed) {
        dbInstance.prepare(`
          INSERT INTO barcode_queue (barcode, status, created_at)
          VALUES (?, 'pending', CURRENT_TIMESTAMP)
        `).run(trimmed);
      }
    } catch {}
  });

  tx();
}

export function clearActiveBarcode(db?: Database.Database): void {
  try {
    const dbInstance = db ?? getDb();
    const tx = dbInstance.transaction(() => {
      try {
        dbInstance.prepare("DELETE FROM active_barcode WHERE id = 1").run();
      } catch {}
      try {
        dbInstance.prepare("UPDATE barcode_queue SET status = 'consumed' WHERE status = 'pending'").run();
      } catch {}
    });
    tx();
  } catch (err) {
    console.error("Failed to clear active barcode:", err);
  }
}
