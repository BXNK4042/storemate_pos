import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/analytics";

export async function GET() {
  try {
    const stats = getDashboardStats();
    return NextResponse.json({ success: true, stats });
  } catch (err) {
    console.error("Dashboard stats failed:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal error",
      },
      { status: 500 }
    );
  }
}
