export type WasteReason = "damaged" | "spoiled" | "expired" | "discarded" | "other";

export interface WasteRecord {
  waste_id: number;
  item_id: number;
  item_name?: string;
  item_barcode?: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  reason: WasteReason;
  notes: string | null;
  user_id: number | null;
  user_name: string | null;
  adjustment_id: number | null;
  created_at: string;
}

export interface CreateWasteInput {
  item_id: number;
  quantity: number;
  reason: WasteReason;
  notes?: string | null;
  unit_cost?: number; // Optional; defaults to item's current item_price
  user_id?: number | null;
  user_name?: string | null;
}

export interface WasteFilterParams {
  item_id?: number;
  reason?: WasteReason | "all";
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  search?: string;    // Matches item_name, barcode, notes, user_name
  page?: number;
  limit?: number;
}

export interface WasteReasonMetric {
  reason: WasteReason;
  count: number;
  quantity: number;
  lossAmount: number;
}

export interface TopWastedItem {
  item_id: number;
  item_name: string;
  item_barcode: string;
  quantity: number;
  totalLoss: number;
}

export interface WasteSummaryMetrics {
  totalIncidents: number;
  totalQuantity: number;
  totalLossAmount: number;
  byReason: Record<WasteReason, WasteReasonMetric>;
  topItems: TopWastedItem[];
}

export interface WasteListResult {
  records: WasteRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  metrics: WasteSummaryMetrics;
}
