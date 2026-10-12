import type { Item } from "./item";

export type StockAdjustmentReason =
  | "restock"
  | "damage"
  | "expired"
  | "inventory_count"
  | "loss"
  | "correction"
  | "sale"
  | "refund"
  | "initial"
  | "other";

export interface StockAdjustmentRecord {
  adjustment_id: number;
  item_id: number;
  item_name?: string;
  item_barcode?: string;
  change_qty: number;
  previous_qty: number;
  new_qty: number;
  reason: StockAdjustmentReason;
  reference_id: string | null;
  note: string | null;
  user_id: number | null;
  user_name: string | null;
  created_at: string;
}

export type StockAdjustmentMode = "add" | "remove" | "set";

export interface CreateStockAdjustmentInput {
  item_id: number;
  mode: StockAdjustmentMode;
  quantity: number; // Positive quantity for 'add'/'remove', target absolute quantity for 'set'
  reason: StockAdjustmentReason;
  note?: string | null;
  reference_id?: string | null;
  user_id?: number | null;
  user_name?: string | null;
}

export interface StockAdjustmentFilterParams {
  item_id?: number;
  reason?: StockAdjustmentReason | "all";
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  search?: string;    // Searches item_name, barcode, note, reference_id
  page?: number;
  limit?: number;
}

export interface StockAdjustmentListResult {
  adjustments: StockAdjustmentRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  metrics: {
    totalIn: number;     // Sum of positive adjustments
    totalOut: number;    // Absolute sum of negative adjustments
    netChange: number;   // Net inventory change
    recordCount: number;
  };
}

export type StockAlertSeverity = "out_of_stock" | "low_stock" | "normal";

export interface StockAlertInfo {
  status: StockAlertSeverity;
  amount: number;
  effectiveThreshold: number;
  isCustomThreshold: boolean;
  label: string;
  badgeClass: string;
  isAttentionNeeded: boolean;
}

export interface LowStockSummary {
  totalProducts: number;
  outOfStockCount: number;
  lowStockCount: number;
  attentionCount: number; // outOfStockCount + lowStockCount
  defaultThreshold: number;
}

export interface ItemWithStockAlert extends Item {
  stockAlert: StockAlertInfo;
}

export interface StockSettings {
  defaultLowThreshold: number;
}
