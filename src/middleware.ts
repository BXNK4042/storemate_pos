import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/token";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files, images, favicon
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("storemate_session")?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (session) {
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (pathname.startsWith("/items") && session.role !== "admin") {
      return NextResponse.redirect(new URL("/cashier", request.url));
    }

    const response = NextResponse.next();
    response.headers.set("x-user-id", String(session.userId));
    response.headers.set("x-user-role", session.role);
    return response;
  }

  // Check /api/data or /api/stock-in with scanner API key for unauthenticated requests
  if (
    pathname === "/api/data" ||
    pathname.startsWith("/api/data/") ||
    pathname === "/api/stock-in" ||
    pathname.startsWith("/api/stock-in/")
  ) {
    const apiKey = request.headers.get("x-api-key");
    const validApiKey = process.env.SCANNER_API_KEY || "pos-scan-key-3849fbc281e047da";
    if (apiKey === validApiKey) {
      return NextResponse.next();
    }
  }

  const isPublic = PUBLIC_PATHS.some((path) => pathname === path);

  if (!isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
