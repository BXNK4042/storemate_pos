import { NextRequest, NextResponse } from "next/server";
import { adjustItemStock, getStockAdjustments, StockError } from "@/lib/stock";
import { getSessionFromRequest } from "@/lib/auth";
import type { StockAdjustmentMode, StockAdjustmentReason } from "@/types/stock";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const itemIdParam = searchParams.get("item_id");
    const itemId = itemIdParam ? parseInt(itemIdParam, 10) : undefined;

    const reason = searchParams.get("reason") as StockAdjustmentReason | "all" | null;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const search = searchParams.get("search") || undefined;

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const result = getStockAdjustments({
      item_id: isNaN(Number(itemId)) ? undefined : itemId,
      reason: reason || undefined,
      startDate,
      endDate,
      search,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Failed to fetch stock adjustments:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "กรุณาเข้าสู่ระบบก่อนทำรายการ" },
        { status: 401 }
      );
    }

    if (session.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "สิทธิ์ไม่เพียงพอ ต้องเป็นผู้ดูแลระบบเท่านั้น" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { item_id, mode, quantity, reason, reference_id, note } = body;

    const parsedItemId = Number(item_id);
    if (isNaN(parsedItemId) || parsedItemId <= 0) {
      return NextResponse.json(
        { success: false, error: "รหัสสินค้าไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    if (!mode || !["add", "remove", "set"].includes(mode)) {
      return NextResponse.json(
        { success: false, error: "โหมดการปรับสต็อกต้องเป็น add, remove หรือ set" },
        { status: 400 }
      );
    }

    const parsedQty = Number(quantity);
    if (isNaN(parsedQty) || (mode !== "set" && parsedQty <= 0) || (mode === "set" && parsedQty < 0)) {
      return NextResponse.json(
        { success: false, error: "จำนวนสินค้าไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== "string") {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุเหตุผลการปรับสต็อก" },
        { status: 400 }
      );
    }

    const result = adjustItemStock({
      item_id: parsedItemId,
      mode: mode as StockAdjustmentMode,
      quantity: parsedQty,
      reason: reason as StockAdjustmentReason,
      reference_id: reference_id || null,
      note: note || null,
      user_id: session.userId,
      user_name: session.username,
    });

    return NextResponse.json({
      success: true,
      data: result.adjustment,
      item: {
        item_id: parsedItemId,
        item_name: result.adjustment.item_name,
        item_amount: result.currentAmount,
      },
    });
  } catch (err) {
    if (err instanceof StockError) {
      return NextResponse.json(
        {
          success: false,
          code: err.code,
          error: err.message,
        },
        { status: 400 }
      );
    }

    console.error("Stock adjustment failed:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
