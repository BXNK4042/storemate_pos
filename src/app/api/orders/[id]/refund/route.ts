import { NextRequest, NextResponse } from "next/server";
import { refundOrder, OrderNotFoundError, OrderAlreadyRefundedError } from "@/lib/orders";
import { getSessionFromRequest } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    const { id } = await params;
    const orderId = parseInt(id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: "รหัสคำสั่งซื้อไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    let reason: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.reason === "string") {
        reason = body.reason;
      }
    } catch {
      // Body is optional; JSON parse error or empty body can be ignored
    }

    const order = refundOrder(orderId, reason, {
      user_id: session?.userId || null,
      user_name: session?.username || null,
    });

    return NextResponse.json({
      success: true,
      message: "คืนเงินและคืนสต็อกสินค้าเรียบร้อยแล้ว",
      order,
    });
  } catch (err: unknown) {
    if (err instanceof OrderNotFoundError || (err as { code?: string })?.code === "ORDER_NOT_FOUND") {
      return NextResponse.json(
        { success: false, error: (err as Error).message || "ไม่พบคำสั่งซื้อ" },
        { status: 404 }
      );
    }

    if (err instanceof OrderAlreadyRefundedError || (err as { code?: string })?.code === "ALREADY_REFUNDED") {
      return NextResponse.json(
        { success: false, error: (err as Error).message || "คำสั่งซื้อนี้ถูกยกเลิก/คืนเงินไปแล้ว" },
        { status: 400 }
      );
    }

    console.error("Refund order error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการคืนเงิน",
      },
      { status: 500 }
    );
  }
}
