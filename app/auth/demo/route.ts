import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_DEMO_SESSION, DEMO_SESSION_COOKIE, demoMode } from "@/lib/data";

// 데모 모드 전용: 로그인이 필요한 화면을 열면 바로 가짜 로그인하고 돌아간다 (spec.md 4.2).
// Supabase가 설정된 서버에서는 쿠키를 쓰지 않고 /login으로 보낸다.
export function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("next") ?? "/me";
  const next = raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/me";
  if (!demoMode) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, request.url));
  const res = NextResponse.redirect(new URL(next, request.url));
  if (!request.cookies.get(DEMO_SESSION_COOKIE)) {
    res.cookies.set(DEMO_SESSION_COOKIE, JSON.stringify(DEFAULT_DEMO_SESSION), {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
