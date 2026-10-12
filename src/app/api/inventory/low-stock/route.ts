import { NextRequest, NextResponse } from "next/server";
import { getLowStockSummary, getLowStockItems } from "@/lib/stock-alerts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const rawStatus = searchParams.get("status");

    let filter: "all" | "out_of_stock" | "low_stock" = "all";
    if (rawStatus === "out_of_stock" || rawStatus === "low_stock") {
      filter = rawStatus;
    }

    const summary = getLowStockSummary();
    const items = getLowStockItems({ filter });

    return NextResponse.json({
      success: true,
      summary,
      items,
    });
  } catch (err) {
    console.error("Failed to query low stock inventory:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
