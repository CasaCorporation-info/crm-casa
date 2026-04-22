import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_VALUATION_HOST = "valutazioni.holdingcasacorporation.it";
const FALLBACK_SITE_URL = "https://holdingcasacorporation.it";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  if (host !== PUBLIC_VALUATION_HOST) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (pathname === "/" || pathname === "/login") {
    return NextResponse.redirect(FALLBACK_SITE_URL);
  }

  if (pathname.startsWith("/valutazioni/holdingcasacorporation/")) {
    return NextResponse.next();
  }

  const token = pathname.replace(/^\/+/, "").trim();

  if (!token) {
    return NextResponse.redirect(FALLBACK_SITE_URL);
  }

  url.pathname = `/valutazioni/holdingcasacorporation/${token}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};