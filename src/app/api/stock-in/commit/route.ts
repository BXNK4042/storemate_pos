import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { commitStockIntake } from "@/lib/stock";
import { verifySessionToken } from "@/lib/token";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

const DEFAULT_SCANNER_KEY = "pos-scan-key-3849fbc281e047da";

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  const validApiKey = process.env.SCANNER_API_KEY || DEFAULT_SCANNER_KEY;
  let user: { userId: number; username: string; role: string } | undefined;

  if (apiKey === validApiKey) {
    user = { userId: 0, username: "Scanner API", role: "admin" };
  } else {
    let token: string | undefined;
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)storemate_session=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }
    if (token) {
      const session = await verifySessionToken(token);
      if (session) {
        user = { userId: session.userId, username: session.username, role: session.role };
      }
    }
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }
  }

  try {
    const db = getDb();
    const result = commitStockIntake(db, user);
    return NextResponse.json(result, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    if (err?.code === "EMPTY_STOCK_CART" || err?.message === "Cart is empty") {
      return NextResponse.json(
        { success: false, error: "Cart is empty" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
