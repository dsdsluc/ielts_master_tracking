import "server-only";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth/session";
import { ApiError } from "@/lib/interactions/errors";
import type { CurrentUser } from "@/lib/auth/dal";

// Pendant of getCurrentUser() (dal.ts) cho Route Handlers: dal.ts dùng
// redirect() khi chưa đăng nhập, nhưng redirect() trong 1 route API sẽ trả
// về 1 response 3xx trỏ /login (HTML) thay vì JSON — fetch() phía client sẽ
// nhận nhầm hoặc lỗi parse. Route Handler cần ném ApiError(401) để trả JSON.
export async function requireApiUser(): Promise<CurrentUser> {
  const session = await readSession();
  if (!session) throw new ApiError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập lại.");

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
      branch: { select: { name: true } },
    },
  });

  if (!user || !user.active) throw new ApiError(401, "UNAUTHENTICATED", "Tài khoản không còn hoạt động.");
  return user;
}
