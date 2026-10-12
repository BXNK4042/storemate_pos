import { NextRequest, NextResponse } from "next/server";
import { getWasteRecords, logWasteItem, WasteError, VALID_WASTE_REASONS } from "@/lib/waste";
import { getSessionFromRequest } from "@/lib/auth";
import type { WasteReason } from "@/types/waste";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const itemIdParam = searchParams.get("item_id");
    const itemId = itemIdParam ? parseInt(itemIdParam, 10) : undefined;

    const reason = searchParams.get("reason") as WasteReason | "all" | null;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const search = searchParams.get("search") || undefined;

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const result = getWasteRecords({
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
    console.error("Failed to fetch waste records:", err);
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

    const body = await req.json();
    const { item_id, quantity, reason, notes, unit_cost } = body;

    const parsedItemId = Number(item_id);
    if (isNaN(parsedItemId) || parsedItemId <= 0) {
      return NextResponse.json(
        { success: false, error: "รหัสสินค้าไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const parsedQty = Number(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0 || !Number.isInteger(parsedQty)) {
      return NextResponse.json(
        { success: false, error: "จำนวนสินค้าต้องเป็นจำนวนเต็มบวกที่มากกว่า 0" },
        { status: 400 }
      );
    }

    if (!reason || !VALID_WASTE_REASONS.includes(reason)) {
      return NextResponse.json(
        { success: false, error: "กรุณาระบุสาเหตุการตัดของเสียให้ถูกต้อง" },
        { status: 400 }
      );
    }

    let parsedCost: number | undefined = undefined;
    if (unit_cost !== undefined && unit_cost !== null && unit_cost !== "") {
      parsedCost = Number(unit_cost);
      if (isNaN(parsedCost) || parsedCost < 0) {
        return NextResponse.json(
          { success: false, error: "ต้นทุนต่อหน่วยต้องไม่ติดลบ" },
          { status: 400 }
        );
      }
    }

    const result = logWasteItem({
      item_id: parsedItemId,
      quantity: parsedQty,
      reason: reason as WasteReason,
      notes: typeof notes === "string" ? notes : null,
      unit_cost: parsedCost,
      user_id: session.userId,
      user_name: session.username,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof WasteError) {
      return NextResponse.json(
        {
          success: false,
          code: err.code,
          error: err.message,
        },
        { status: 400 }
      );
    }

    console.error("Waste logging failed:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
