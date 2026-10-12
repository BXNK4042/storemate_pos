import { NextRequest, NextResponse } from "next/server";
import { createOrder, getOrders, type CreateOrderItemInput } from "@/lib/orders";
import { getSessionFromRequest } from "@/lib/auth";

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
    const session = await getSessionFromRequest(req);
    const body = await req.json();
    const items = body.items as CreateOrderItemInput[];
    const {
      payment_method,
      amount_paid,
      change_amount,
      discount_type,
      discount_value,
      promptpay_type,
      promptpay_ref,
      promptpay_payload,
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "รายการสินค้าว่างเปล่า" },
        { status: 400 }
      );
    }

    if (payment_method === "cash" && amount_paid !== undefined) {
      if (typeof amount_paid !== "number" || isNaN(amount_paid) || amount_paid < 0 || amount_paid > 10_000_000) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_CASH_AMOUNT",
            error: "จำนวนเงินสดที่ระบุไม่ถูกต้อง (ต้องอยู่ระหว่าง 0 ถึง 10,000,000 บาท)",
          },
          { status: 400 }
        );
      }
    }

    const order = createOrder(items, {
      payment_method,
      amount_paid,
      change_amount,
      discount_type,
      discount_value,
      promptpay_type,
      promptpay_ref,
      promptpay_payload,
      user_id: session?.userId || null,
      user_name: session?.username || null,
    });
    return NextResponse.json({ success: true, order });
  } catch (err: unknown) {
    console.error("Order creation failed:", err);
    const errorCode = (err as { code?: string })?.code;
    return NextResponse.json(
      {
        success: false,
        code: errorCode,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 400 }
    );
  }
}
