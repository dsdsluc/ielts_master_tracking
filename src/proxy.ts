import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { ROLES } from "@/lib/interactions/constants";

const PUBLIC_ROUTES = ["/login"];

// Kiểm tra optimistic: chỉ đọc JWT từ cookie, không chạm DB. Bảo vệ mọi
// route thuộc nhóm (app); (auth)/login tự xử lý redirect ngược khi đã đăng
// nhập. Kiểm tra "chắc chắn" (user còn active hay không) nằm ở DAL
// (getCurrentUser) vì đó là nơi dữ liệu thật sự được truy vấn.
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  const session = await decryptSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!isPublicRoute && !session) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublicRoute && session) {
    const homePath = session.role === ROLES.SALES ? "/dashboard-sale" : "/";
    return NextResponse.redirect(new URL(homePath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
