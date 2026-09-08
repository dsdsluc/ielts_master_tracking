import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession, type SessionPayload } from "@/lib/auth/session";
import { getHomePathForRole } from "@/lib/nav";

// Optimistic: chỉ đọc payload từ cookie JWT, không chạm DB. Dùng cho các
// trang cần biết "đã đăng nhập chưa" nhanh (redirect nếu chưa).
export const verifySession = cache(async (): Promise<SessionPayload> => {
  const session = await readSession();
  if (!session) {
    redirect("/login");
  }
  return session;
});

// Secure: xác nhận user vẫn tồn tại + còn active trong DB, trả về dữ liệu
// hiển thị được (không có passwordHash). Dùng khi cần dữ liệu chắc chắn mới
// nhất (đổi vai trò, khoá tài khoản...).
export const getCurrentUser = cache(async () => {
  const session = await verifySession();

  const user = await prisma.user.findUnique({
    where: { email: session.email },
    select: {
      email: true,
      fullName: true,
      role: true,
      branchCode: true,
      viewAllBranches: true,
      active: true,
      mustChangePassword: true,
      canCloseMktReport: true,
      branch: { select: { name: true } },
    },
  });

  if (!user || !user.active) {
    // Không redirect("/login") thẳng ở đây — đang render Server Component nên
    // không được phép xoá cookie, mà cookie JWT (còn hạn) vẫn còn thì proxy.ts
    // sẽ coi "/login" là đã đăng nhập rồi đá ngược lại đây, gây lặp vô hạn.
    // Route Handler /api/auth/session-expired xoá cookie trước khi redirect.
    redirect("/api/auth/session-expired");
  }

  return user;
});

export async function requireRole(...roles: string[]) {
  const user = await getCurrentUser();
  if (!roles.includes(user.role)) {
    redirect(getHomePathForRole(user.role));
  }
  return user;
}

export type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;
