import { getOrders } from "@/lib/orders";
import OrdersView, { OrderSummary } from "./orders-view";

export const dynamic = "force-dynamic";

export default function OrdersPage() {
  const result = getOrders(50, 0);
  const orders: OrderSummary[] = (result.orders || []).map((o) => ({
    order_id: o.order_id,
    order_name: o.order_name,
    order_price: o.order_price,
    subtotal: o.subtotal,
    discount_type: o.discount_type,
    discount_value: o.discount_value,
    discount_amount: o.discount_amount,
    payment_method: o.payment_method,
    amount_paid: o.amount_paid,
    change_amount: o.change_amount,
    promptpay_type: o.promptpay_type,
    promptpay_ref: o.promptpay_ref,
    promptpay_payload: o.promptpay_payload,
    status: o.status,
    refund_reason: o.refund_reason,
    created_at: o.created_at,
    total_quantity: o.total_quantity,
  }));

  return <OrdersView initialOrders={orders} />;
}
