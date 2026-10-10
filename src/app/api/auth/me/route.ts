import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    authenticated: true,
    user: {
      userId: 1,
      username: "admin",
      role: "admin",
    },
  });
}
