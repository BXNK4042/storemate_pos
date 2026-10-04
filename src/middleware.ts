import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/token";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files, images, favicon
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/logout") ||
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

  const isPublic = PUBLIC_PATHS.some((path) => pathname === path);

  if (!session) {
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

  // Already logged in, redirect away from /login
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Role check: cashier cannot access /items inventory management
  if (pathname.startsWith("/items") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/cashier", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("x-user-id", String(session.userId));
  response.headers.set("x-user-role", session.role);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
