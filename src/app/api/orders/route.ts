import { NextRequest, NextResponse } from "next/server";
import { createOrder, getOrders, type CreateOrderItemInput } from "@/lib/orders";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50", 10));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    const result = getOrders(limit, offset);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Failed to fetch orders:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items = body.items as CreateOrderItemInput[];
    const { payment_method, amount_paid, change_amount } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "รายการสินค้าว่างเปล่า" },
        { status: 400 }
      );
    }

    const order = createOrder(items, {
      payment_method,
      amount_paid,
      change_amount,
    });
    return NextResponse.json({ success: true, order });
  } catch (err) {
    console.error("Order creation failed:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 400 }
    );
  }
}
