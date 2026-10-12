import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import {
  getDefaultLowStockThreshold,
  updateDefaultLowStockThreshold,
  StockAlertError,
  MIN_STOCK_THRESHOLD,
  MAX_STOCK_THRESHOLD,
} from "@/lib/stock-alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const defaultThreshold = getDefaultLowStockThreshold();
    return NextResponse.json({
      success: true,
      defaultThreshold,
    });
  } catch (err) {
    console.error("Failed to load stock settings:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    const headerRole = req.headers.get("x-user-role");
    const userRole = session?.role || headerRole;

    if (userRole && userRole !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error: "ไม่มีสิทธิ์เข้าถึง (เฉพาะผู้ดูแลระบบเท่านั้น)",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const rawThreshold = body?.defaultThreshold;
    const thresholdNum = Number(rawThreshold);

    if (
      rawThreshold === undefined ||
      rawThreshold === null ||
      !Number.isInteger(thresholdNum) ||
      thresholdNum < MIN_STOCK_THRESHOLD ||
      thresholdNum > MAX_STOCK_THRESHOLD
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `ค่าเกณฑ์สต็อกต้องเป็นจำนวนเต็มตั้งแต่ ${MIN_STOCK_THRESHOLD} ถึง ${MAX_STOCK_THRESHOLD}`,
        },
        { status: 400 }
      );
    }

    const updatedThreshold = updateDefaultLowStockThreshold(thresholdNum);

    return NextResponse.json({
      success: true,
      defaultThreshold: updatedThreshold,
    });
  } catch (err) {
    if (err instanceof StockAlertError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: 400 }
      );
    }
    console.error("Failed to update stock settings:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
