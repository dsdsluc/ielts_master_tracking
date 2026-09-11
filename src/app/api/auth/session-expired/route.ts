import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth/session";

// getCurrentUser() (dal.ts) gọi tới đây khi JWT trong cookie vẫn còn hạn/hợp
// lệ nhưng user tương ứng đã bị xoá/khoá trong DB. Phải xoá cookie ở Route
// Handler (nơi DUY NHẤT được phép ghi cookie ngoài Server Action) rồi mới
// redirect sang /login — nếu gọi thẳng redirect("/login") từ dal.ts (đang
// render Server Component) thì cookie không xoá được, khiến proxy.ts vẫn thấy
// "còn phiên" ở /login rồi đá ngược về trang cũ → lặp vô hạn (ERR_TOO_MANY_REDIRECTS).
export async function GET(request: Request) {
  await deleteSession();
  return NextResponse.redirect(new URL("/login?reason=session-expired", request.url));
}
