import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { WHITELABEL_RESERVED_SLUGS } from "@/features/master-service/whitelabel-url";

const SESSION_COOKIE = "cotacondo_session";

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET inválido");
  }
  return new TextEncoder().encode(secret);
}

function redirectToLogin(request: NextRequest, pathname: string, clearCookie = false) {
  const url = request.nextUrl.clone();
  url.pathname = "/acesse";
  url.searchParams.set("next", pathname);
  const response = NextResponse.redirect(url);
  if (clearCookie) {
    response.cookies.delete(SESSION_COOKIE);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAppRoute = pathname.startsWith("/app");
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (isAppRoute) {
    if (!token) {
      return redirectToLogin(request, pathname);
    }

    try {
      await jwtVerify(token, getSecretKey());
      return NextResponse.next();
    } catch {
      return redirectToLogin(request, pathname, true);
    }
  }

  // Whitelabel curto: /selladm → /s/selladm (sem afetar rotas reservadas)
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1) {
    const slug = segments[0].toLowerCase();
    if (!WHITELABEL_RESERVED_SLUGS.has(slug) && !slug.includes(".")) {
      const url = request.nextUrl.clone();
      url.pathname = `/s/${segments[0]}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/app/:path*",
    "/((?!_next/static|_next/image|favicon.ico|brand/|templates/).*)",
  ],
};
