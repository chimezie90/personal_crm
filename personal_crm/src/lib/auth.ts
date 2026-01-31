import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * Authentication result type
 */
export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: string;
}

/**
 * Authentication error response
 */
export interface AuthError {
  error: string;
  code: "UNAUTHORIZED" | "FORBIDDEN";
}

/**
 * Environment variable for API key authentication.
 * In development, if not set, authentication is disabled for ease of testing.
 */
const API_KEY = process.env.CRM_API_KEY;
const SESSION_COOKIE_NAME = "crm_session";

/**
 * Check if authentication is enabled.
 * Authentication is required in production or when CRM_API_KEY is explicitly set.
 */
function isAuthEnabled(): boolean {
  return process.env.NODE_ENV === "production" || !!API_KEY;
}

/**
 * Verify API request authentication.
 *
 * Checks for authentication via:
 * 1. Authorization header with Bearer token (API key)
 * 2. X-API-Key header
 * 3. Session cookie (for browser-based requests)
 *
 * @param request - NextRequest object
 * @returns AuthResult with authentication status
 */
export async function verifyApiAuth(request: NextRequest): Promise<AuthResult> {
  // Skip auth in development if no API key is configured
  if (!isAuthEnabled()) {
    return { authenticated: true, userId: "dev-user" };
  }

  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (API_KEY && token === API_KEY) {
      return { authenticated: true, userId: "api-user" };
    }
  }

  // Check X-API-Key header
  const apiKeyHeader = request.headers.get("x-api-key");
  if (API_KEY && apiKeyHeader === API_KEY) {
    return { authenticated: true, userId: "api-user" };
  }

  // Check session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  if (sessionCookie?.value) {
    // For a personal CRM, a valid session cookie presence is sufficient
    // In a multi-user app, you'd validate the session token against a database
    const isValidSession = await validateSession(sessionCookie.value);
    if (isValidSession) {
      return { authenticated: true, userId: "session-user" };
    }
  }

  return {
    authenticated: false,
    error: "Authentication required. Provide a valid API key or session.",
  };
}

/**
 * Verify server action authentication.
 *
 * Server actions run on the server but are triggered by the client.
 * We check for session cookies since server actions are typically
 * called from authenticated pages.
 *
 * @returns AuthResult with authentication status
 */
export async function verifyServerActionAuth(): Promise<AuthResult> {
  // Skip auth in development if no API key is configured
  if (!isAuthEnabled()) {
    return { authenticated: true, userId: "dev-user" };
  }

  // Check session cookie using Next.js cookies() function
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (sessionCookie?.value) {
    const isValidSession = await validateSession(sessionCookie.value);
    if (isValidSession) {
      return { authenticated: true, userId: "session-user" };
    }
  }

  // Check for API key in headers (for programmatic access)
  const headerStore = await headers();
  const apiKeyHeader = headerStore.get("x-api-key");
  if (API_KEY && apiKeyHeader === API_KEY) {
    return { authenticated: true, userId: "api-user" };
  }

  const authHeader = headerStore.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (API_KEY && token === API_KEY) {
      return { authenticated: true, userId: "api-user" };
    }
  }

  return {
    authenticated: false,
    error: "Authentication required. Please log in or provide valid credentials.",
  };
}

/**
 * Validate a session token.
 *
 * For a personal CRM, we use a simple validation approach.
 * The session token should match a known pattern or be stored in database.
 *
 * @param sessionToken - The session token to validate
 * @returns Whether the session is valid
 */
async function validateSession(sessionToken: string): Promise<boolean> {
  // For a personal CRM with no external auth provider, we validate that:
  // 1. The token exists and is non-empty
  // 2. The token matches expected format (simple presence check for now)
  //
  // In a production multi-user app, you would:
  // - Check the session against a database/Redis
  // - Verify the session hasn't expired
  // - Check the session signature

  if (!sessionToken || sessionToken.length < 10) {
    return false;
  }

  // Environment variable for session secret validation
  const sessionSecret = process.env.CRM_SESSION_SECRET;
  if (sessionSecret) {
    // If a session secret is configured, validate the token format
    // Expected format: userId:timestamp:signature
    const parts = sessionToken.split(":");
    if (parts.length !== 3) {
      return false;
    }
    // In a real implementation, verify the signature
    return true;
  }

  // If no session secret is configured, accept any non-empty token
  // This allows for simple cookie-based "auth" in development
  return true;
}

/**
 * Create an unauthorized response for API routes.
 *
 * @param message - Optional custom error message
 * @returns NextResponse with 401 status
 */
export function unauthorizedResponse(message?: string): NextResponse<AuthError> {
  return NextResponse.json(
    {
      error: message || "Unauthorized. Authentication required.",
      code: "UNAUTHORIZED" as const,
    },
    { status: 401 }
  );
}

/**
 * Require authentication for an API route handler.
 *
 * This is a higher-order function that wraps an API handler
 * with authentication checks.
 *
 * @example
 * export const POST = withAuth(async (request, auth) => {
 *   // auth.userId is available here
 *   return NextResponse.json({ success: true });
 * });
 */
export function withAuth<T>(
  handler: (
    request: NextRequest,
    auth: AuthResult
  ) => Promise<NextResponse<T>>
): (request: NextRequest) => Promise<NextResponse<T | AuthError>> {
  return async (request: NextRequest) => {
    const auth = await verifyApiAuth(request);

    if (!auth.authenticated) {
      return unauthorizedResponse(auth.error);
    }

    return handler(request, auth);
  };
}

/**
 * Require authentication for a server action.
 *
 * Call this at the beginning of any server action that requires authentication.
 * Throws an error if not authenticated.
 *
 * @example
 * export async function myServerAction() {
 *   await requireAuth();
 *   // ... rest of the action
 * }
 */
export async function requireAuth(): Promise<AuthResult> {
  const auth = await verifyServerActionAuth();

  if (!auth.authenticated) {
    throw new Error(auth.error || "Authentication required");
  }

  return auth;
}
