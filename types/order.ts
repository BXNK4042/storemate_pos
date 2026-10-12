export interface Order {
  order_id: number;
  order_name: string;
  order_price: number;
  subtotal?: number;
  discount_type?: string | null;
  discount_value?: number;
  discount_amount?: number;
  payment_method?: string;
  amount_paid?: number;
  change_amount?: number;
  promptpay_type?: "dynamic" | "static" | null;
  promptpay_ref?: string | null;
  promptpay_payload?: string | null;
  status?: string;
  refund_reason?: string | null;
  created_at?: string;
}

export type {
  ThaiDenominationType,
  ThaiDenomination,
  DenominationBreakdown,
  CashCalculationResult,
  SmartCashOptions,
} from "@/lib/cash";
