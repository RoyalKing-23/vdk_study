// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const REFRESH_API_PATH = "/api/TokenManager/refreshTokens";
// Safely access env vars
const REFRESH_API_KEY = process.env.REFRESH_API_KEY;
// Add track-anon to public paths to prevent loops
const PUBLIC_API_PATHS = ["/api/auth", "/api/track-anon"];
const ADMIN_API_PATHS = ["/api/admin"];

// Helper to get SECRET safely
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET is not set");
    return new TextEncoder().encode("fallback_secret_to_prevent_crash_but_auth_will_fail");
  }
  return new TextEncoder().encode(secret);
}

const SECRET = getSecret();

// Add a web-compatible UUID v4 generator
function generateUUIDv4() {
  // https://stackoverflow.com/a/2117523/2715716
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper to get or set anon_id cookie
async function getOrSetAnonId(req: NextRequest, baseUrl: string, res?: NextResponse) {
  let anon_id = req.cookies.get("anon_id")?.value;
  if (!anon_id) {
    anon_id = generateUUIDv4();
    if (res) {
      res.cookies.set("anon_id", anon_id, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    // Track anon (fire and forget)
    try {
      await fetch(`${baseUrl}/api/track-anon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anon_id,
          useragent: req.headers.get("user-agent"),
          ip: "",
        }),
        keepalive: true,
      });
    } catch (err) {
      console.error("Failed to track anon user:", err);
    }
  }
  return anon_id;
}

export async function middleware(req: NextRequest) {
  // Determine Base URL dynamically if not set
  const baseUrl = process.env.BASE_URL || req.nextUrl.origin;

  const { pathname } = req.nextUrl;
  const adminToken = req.cookies.get("admin_token")?.value;

  const adminDashboard = req.nextUrl.clone();
  adminDashboard.pathname = "/admin/dashboard";

  if (pathname === "/admin/login" && adminToken) {
    try {
      const { payload } = await jwtVerify(adminToken, SECRET);
      if (payload?.admin) return NextResponse.redirect(adminDashboard);
    } catch { }
  }

  // ✅ Admin route protection
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";

    if (!adminToken) return NextResponse.redirect(url);

    try {
      const { payload } = await jwtVerify(adminToken, SECRET);
      if (!payload.admin) throw new Error("Not an admin");
    } catch {
      return NextResponse.redirect(url);
    }
  }

  const token = req.cookies.get("accessToken")?.value;

  if (pathname === REFRESH_API_PATH) {
    // check API key
    const apiKeyFromQuery = req.nextUrl.searchParams.get("key");
    const apiKeyFromHeader = req.headers.get("x-api-key");

    if (
      apiKeyFromQuery !== REFRESH_API_KEY &&
      apiKeyFromHeader !== REFRESH_API_KEY
    ) {
      return new Response("Unauthorized BABU", { status: 401 });
    }
    return NextResponse.next();
  }

  // NEW: If user is logged in and tries to access /auth, redirect to /study
  if (pathname === "/auth" && token) {
    try {
      await jwtVerify(token, SECRET);
      const url = req.nextUrl.clone();
      url.pathname = "/study";
      return NextResponse.redirect(url);
    } catch {
      // token invalid, allow to /auth
      return redirectWithCookieClear(req);
    }
  }

  const isApi = pathname.startsWith("/api/");
  const isPublicApi = (path: string) => PUBLIC_API_PATHS.some((publicPath) => path.startsWith(publicPath));
  const isAdminApi = (path: string) => ADMIN_API_PATHS.some((adminPath) => path.startsWith(adminPath));

  const isProtectedApi = isApi && !(isPublicApi(pathname) || isAdminApi(pathname));
  const isStudyPage = pathname.startsWith("/study");
  const isWatchPage = pathname.startsWith("/watch");

  if (isProtectedApi || isStudyPage || isWatchPage) {
    if (!token) {
      return redirectWithCookieClear(req);
    }

    try {
      await jwtVerify(token, SECRET);
      return NextResponse.next();
    } catch (err: any) {
      console.warn("JWT invalid or expired:", err);
      return redirectWithCookieClear(req);
    }
  }

  return NextResponse.next();
}

function redirectWithCookieClear(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/auth", req.url));

  res.cookies.set("accessToken", "", { path: "/", expires: new Date(0) });
  res.cookies.set("refreshToken", "", { path: "/", expires: new Date(0) });

  return res;
}

export const config = {
  matcher: [
    // Include all routes EXCEPT:
    // - _next (Next.js internal assets)
    // - static files (e.g., favicon, images)
    // - any file with an extension (e.g., .js, .css)
    "/((?!_next|favicon.ico|.*\\..*).*)",
  ],
};