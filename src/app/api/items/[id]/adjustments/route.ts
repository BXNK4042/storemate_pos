import { NextRequest, NextResponse } from "next/server";
import { getItemStockHistory } from "@/lib/stock";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = parseInt(id, 10);

    if (isNaN(itemId) || itemId <= 0) {
      return NextResponse.json(
        { success: false, error: "รหัสสินค้าไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const adjustments = getItemStockHistory(itemId, limit);

    return NextResponse.json({
      success: true,
      data: adjustments,
    });
  } catch (err) {
    console.error("Failed to fetch item stock history:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
