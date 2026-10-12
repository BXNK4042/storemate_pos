import type { StockAlertInfo, StockAlertSeverity } from "@/types/stock";

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
export const MIN_STOCK_THRESHOLD = 1;
export const MAX_STOCK_THRESHOLD = 1000;

export class StockAlertError extends Error {
  code: string;
  constructor(message: string, code = "STOCK_ALERT_ERROR") {
    super(message);
    this.name = "StockAlertError";
    this.code = code;
  }
}

/**
 * Compute the effective threshold for an item.
 * If item has a custom valid threshold (> 0), use it. Otherwise fall back to store default.
 */
export function getEffectiveThreshold(
  itemThreshold: number | null | undefined,
  defaultThreshold: number
): number {
  if (
    itemThreshold !== null &&
    itemThreshold !== undefined &&
    typeof itemThreshold === "number" &&
    Number.isFinite(itemThreshold) &&
    itemThreshold > 0
  ) {
    return Math.floor(itemThreshold);
  }
  return defaultThreshold;
}

/**
 * Deterministically evaluate stock status for an item given its amount and effective threshold.
 */
export function evaluateStockStatus(
  amount: number,
  effectiveThreshold: number,
  isCustomThreshold = false
): StockAlertInfo {
  let status: StockAlertSeverity;
  let label: string;
  let badgeClass: string;
  let isAttentionNeeded: boolean;

  if (amount <= 0) {
    status = "out_of_stock";
    label = "สินค้าหมด";
    badgeClass = "bg-rose-100 text-rose-800 border-rose-200";
    isAttentionNeeded = true;
  } else if (amount <= effectiveThreshold) {
    status = "low_stock";
    label = "สต็อกใกล้หมด";
    badgeClass = "bg-amber-100 text-amber-800 border-amber-200";
    isAttentionNeeded = true;
  } else {
    status = "normal";
    label = "ปกติ";
    badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
    isAttentionNeeded = false;
  }

  return {
    status,
    amount,
    effectiveThreshold,
    isCustomThreshold,
    label,
    badgeClass,
    isAttentionNeeded,
  };
}
