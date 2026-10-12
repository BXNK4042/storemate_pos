import getDb from "./db";
import type Database from "better-sqlite3";
import { type PromptPayIdType, type PromptPayMode } from "./promptpay";

export interface PaymentSettings {
  enabled: boolean;
  idType: PromptPayIdType;
  id: string;
  merchantName: string;
  defaultMode: PromptPayMode;
}

export interface ReceiptSettings {
  storeName: string;
  storeAddress: string;
  storeTaxId: string;
  storePhone: string;
  footerMessage: string;
  paperWidth: number;
}

const DEFAULT_SETTINGS: PaymentSettings = {
  enabled: true,
  idType: "phone",
  id: "",
  merchantName: "StoreMate POS",
  defaultMode: "dynamic",
};

const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  storeName: "ร้านค้า StoreMate",
  storeAddress: "",
  storeTaxId: "",
  storePhone: "",
  footerMessage: "ขอบคุณที่ใช้บริการ",
  paperWidth: 32,
};

export function ensureSettingsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure default payment settings exist if not already set
  const stmt = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  stmt.run("promptpay_enabled", String(DEFAULT_SETTINGS.enabled));
  stmt.run("promptpay_id_type", DEFAULT_SETTINGS.idType);
  stmt.run("promptpay_id", DEFAULT_SETTINGS.id);
  stmt.run("promptpay_merchant_name", DEFAULT_SETTINGS.merchantName);
  stmt.run("promptpay_default_mode", DEFAULT_SETTINGS.defaultMode);

  // Ensure default receipt settings exist if not already set
  stmt.run("receipt_store_name", DEFAULT_RECEIPT_SETTINGS.storeName);
  stmt.run("receipt_store_address", DEFAULT_RECEIPT_SETTINGS.storeAddress);
  stmt.run("receipt_store_tax_id", DEFAULT_RECEIPT_SETTINGS.storeTaxId);
  stmt.run("receipt_store_phone", DEFAULT_RECEIPT_SETTINGS.storePhone);
  stmt.run("receipt_footer_message", DEFAULT_RECEIPT_SETTINGS.footerMessage);
  stmt.run("receipt_paper_width", String(DEFAULT_RECEIPT_SETTINGS.paperWidth));

  // Ensure default stock settings exist if not already set
  stmt.run("stock_default_low_threshold", "5");
}

export function getPaymentSettings(): PaymentSettings {
  const db = getDb();
  ensureSettingsTable(db);

  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'promptpay_%'").all() as {
    key: string;
    value: string;
  }[];

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.key, row.value);
  }

  const enabledStr = map.get("promptpay_enabled");
  const enabled = enabledStr !== undefined ? enabledStr === "true" || enabledStr === "1" : DEFAULT_SETTINGS.enabled;
  const rawIdType = map.get("promptpay_id_type");
  const idType: PromptPayIdType =
    rawIdType === "citizen_id" || rawIdType === "ewallet" ? rawIdType : "phone";

  const rawMode = map.get("promptpay_default_mode");
  const defaultMode: PromptPayMode = rawMode === "static" ? "static" : "dynamic";

  return {
    enabled,
    idType,
    id: map.get("promptpay_id") ?? DEFAULT_SETTINGS.id,
    merchantName: map.get("promptpay_merchant_name") ?? DEFAULT_SETTINGS.merchantName,
    defaultMode,
  };
}

export function updatePaymentSettings(settings: Partial<PaymentSettings>): PaymentSettings {
  const db = getDb();
  ensureSettingsTable(db);

  const tx = db.transaction(() => {
    const upsertStmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);

    if (settings.enabled !== undefined) {
      upsertStmt.run("promptpay_enabled", String(settings.enabled));
    }
    if (settings.idType !== undefined) {
      upsertStmt.run("promptpay_id_type", settings.idType);
    }
    if (settings.id !== undefined) {
      upsertStmt.run("promptpay_id", settings.id.trim());
    }
    if (settings.merchantName !== undefined) {
      upsertStmt.run("promptpay_merchant_name", settings.merchantName.trim());
    }
    if (settings.defaultMode !== undefined) {
      upsertStmt.run("promptpay_default_mode", settings.defaultMode);
    }
  });

  tx();
  return getPaymentSettings();
}

export function getReceiptSettings(): ReceiptSettings {
  const db = getDb();
  ensureSettingsTable(db);

  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'receipt_%'").all() as {
    key: string;
    value: string;
  }[];

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.key, row.value);
  }

  const rawWidth = parseInt(map.get("receipt_paper_width") ?? "", 10);
  const paperWidth = !isNaN(rawWidth) && rawWidth > 0 ? rawWidth : DEFAULT_RECEIPT_SETTINGS.paperWidth;

  return {
    storeName: map.get("receipt_store_name") ?? DEFAULT_RECEIPT_SETTINGS.storeName,
    storeAddress: map.get("receipt_store_address") ?? DEFAULT_RECEIPT_SETTINGS.storeAddress,
    storeTaxId: map.get("receipt_store_tax_id") ?? DEFAULT_RECEIPT_SETTINGS.storeTaxId,
    storePhone: map.get("receipt_store_phone") ?? DEFAULT_RECEIPT_SETTINGS.storePhone,
    footerMessage: map.get("receipt_footer_message") ?? DEFAULT_RECEIPT_SETTINGS.footerMessage,
    paperWidth,
  };
}

export function updateReceiptSettings(settings: Partial<ReceiptSettings>): ReceiptSettings {
  const db = getDb();
  ensureSettingsTable(db);

  const tx = db.transaction(() => {
    const upsertStmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);

    if (settings.storeName !== undefined) {
      upsertStmt.run("receipt_store_name", settings.storeName.trim());
    }
    if (settings.storeAddress !== undefined) {
      upsertStmt.run("receipt_store_address", settings.storeAddress.trim());
    }
    if (settings.storeTaxId !== undefined) {
      upsertStmt.run("receipt_store_tax_id", settings.storeTaxId.trim());
    }
    if (settings.storePhone !== undefined) {
      upsertStmt.run("receipt_store_phone", settings.storePhone.trim());
    }
    if (settings.footerMessage !== undefined) {
      upsertStmt.run("receipt_footer_message", settings.footerMessage.trim());
    }
    if (settings.paperWidth !== undefined) {
      upsertStmt.run("receipt_paper_width", String(settings.paperWidth));
    }
  });

  tx();
  return getReceiptSettings();
}

