"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/app/(app)/admin/require-admin";
import { friendlyPrismaError, parseOrThrow } from "@/app/(app)/admin/prisma-error";
import { ROLES } from "@/lib/interactions/constants";

const DEFAULT_PASSWORD = "12345678";
const ROLE_VALUES = Object.values(ROLES) as [string, ...string[]];

const userSchema = z.object({
  fullName: z.string().trim().min(1, "Vui lòng nhập họ tên."),
  role: z.enum(ROLE_VALUES),
  branchCode: z.string().trim().optional(),
  viewAllBranches: z.boolean(),
  canCloseMktReport: z.boolean(),
  note: z.string().trim().optional(),
});

function normalizeBranchScope(data: z.infer<typeof userSchema>) {
  // Sale/Admin luôn bị khoá đúng 1 cơ sở — ép về đúng ràng buộc mà
  // requireValidSaleBranchScope() (mutations.ts) kiểm tra, để không tạo ra
  // tài khoản Sale không dùng được các thao tác tạo/sửa lead.
  if (data.role === ROLES.SALES) {
    if (!data.branchCode) throw new Error("Vai trò Sale/Admin bắt buộc chọn đúng 1 cơ sở phụ trách.");
    return { branchCode: data.branchCode, viewAllBranches: false };
  }
  return { branchCode: data.branchCode || null, viewAllBranches: data.viewAllBranches };
}

export async function createUser(input: { email: string; password?: string } & z.input<typeof userSchema>) {
  await requireAdmin();
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email không hợp lệ.");
  const data = parseOrThrow(userSchema, input);
  const scope = normalizeBranchScope(data);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Đã có tài khoản với email này.");

  const passwordHash = await hashPassword((input.password || DEFAULT_PASSWORD).trim());

  await prisma.user
    .create({
      data: {
        email,
        fullName: data.fullName,
        role: data.role,
        branchCode: scope.branchCode,
        viewAllBranches: scope.viewAllBranches,
        canCloseMktReport: data.canCloseMktReport,
        note: data.note || null,
        active: true,
        passwordHash,
        mustChangePassword: true,
      },
    })
    .catch((err) => friendlyPrismaError(err, "Không tạo được tài khoản."));

  revalidatePath("/admin/users");
}

export async function updateUser(currentEmail: string, input: { email: string } & z.input<typeof userSchema>) {
  const actor = await requireAdmin();
  const newEmail = input.email.trim().toLowerCase();
  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) throw new Error("Email không hợp lệ.");
  const data = parseOrThrow(userSchema, input);
  const scope = normalizeBranchScope(data);

  if (currentEmail === actor.email && data.role !== ROLES.ADMIN) {
    throw new Error("Không thể tự đổi vai trò của chính mình khỏi Quản trị hệ thống.");
  }

  if (newEmail !== currentEmail) {
    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing) throw new Error("Đã có tài khoản khác dùng email này.");
  }

  await prisma.user
    .update({
      where: { email: currentEmail },
      data: {
        email: newEmail,
        fullName: data.fullName,
        role: data.role,
        branchCode: scope.branchCode,
        viewAllBranches: scope.viewAllBranches,
        canCloseMktReport: data.canCloseMktReport,
        note: data.note || null,
      },
    })
    .catch((err) => {
      // Đổi email = đổi khoá chính — nếu tài khoản đã có lịch sử (tạo/xử lý
      // lead, log hệ thống...) tham chiếu tới email cũ, DB sẽ chặn bằng lỗi
      // khoá ngoại (P2003). Bắt riêng để báo rõ nguyên nhân thay vì lỗi chung chung.
      if (err && typeof err === "object" && "code" in err && err.code === "P2003") {
        throw new Error("Không đổi được email vì tài khoản này đã có hoạt động (đã tạo/xử lý liên hệ). Hãy tạo tài khoản mới thay vì đổi email.");
      }
      friendlyPrismaError(err, "Không cập nhật được tài khoản.");
    });

  revalidatePath("/admin/users");
}

export async function setUserActive(email: string, active: boolean) {
  const actor = await requireAdmin();
  if (email === actor.email && !active) {
    throw new Error("Không thể tự khoá tài khoản của chính mình.");
  }
  await prisma.user.update({ where: { email }, data: { active } }).catch((err) => friendlyPrismaError(err, "Không cập nhật được trạng thái."));
  revalidatePath("/admin/users");
}

export async function resetUserPassword(email: string, newPassword: string, mustChangePassword: boolean) {
  await requireAdmin();
  const password = newPassword.trim();
  if (password.length < 6) throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự.");

  const passwordHash = await hashPassword(password);
  await prisma.user
    .update({ where: { email }, data: { passwordHash, mustChangePassword } })
    .catch((err) => friendlyPrismaError(err, "Không đặt lại được mật khẩu."));
  revalidatePath("/admin/users");
}
