import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

const HMAC_KEY = "human-lives-auth";

/** HMAC-based comparison avoids leaking input length via early return */
function safeCompare(a: string, b: string): boolean {
  const hmacA = createHmac("sha256", HMAC_KEY).update(a).digest();
  const hmacB = createHmac("sha256", HMAC_KEY).update(b).digest();
  return timingSafeEqual(hmacA, hmacB);
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
