import { createOrder, type CreateOrderItemInput } from "@/lib/orders";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items = body.items as CreateOrderItemInput[];

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json(
        { success: false, error: "รายการสินค้าว่างเปล่า" },
        { status: 400 }
      );
    }

    const order = createOrder(items);
    return Response.json({ success: true, order });
  } catch (err) {
    console.error("Order creation failed:", err);
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
