import { getOrders } from "@/lib/orders";
import OrdersView, { OrderSummary } from "./orders-view";

export const dynamic = "force-dynamic";

export default function OrdersPage() {
  const result = getOrders(50, 0);
  const orders: OrderSummary[] = (result.orders || []).map((o) => ({
    order_id: o.order_id,
    order_name: o.order_name,
    order_price: o.order_price,
    created_at: o.created_at,
    total_quantity: o.total_quantity,
  }));

  return <OrdersView initialOrders={orders} />;
}
