import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
    });
  }

  const credentials = Buffer.from(authHeader.slice(6), "base64").toString();
  const colonIndex = credentials.indexOf(":");
  if (colonIndex === -1) {
    return new NextResponse("Invalid credentials", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
    });
  }

  const user = credentials.slice(0, colonIndex);
  const pass = credentials.slice(colonIndex + 1);
  const validUser = process.env.ADMIN_USER ?? "admin";
  const validPass = process.env.ADMIN_PASS ?? "";

  if (!validPass || !safeCompare(user, validUser) || !safeCompare(pass, validPass)) {
    return new NextResponse("Invalid credentials", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
    });
  }

  return NextResponse.next();
}

export const config = { matcher: "/admin/:path*" };
