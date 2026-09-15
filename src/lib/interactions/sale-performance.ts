import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ROLES, STATUS } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { canViewAllBranches } from "@/lib/interactions/scope";
import type { CurrentUser } from "@/lib/auth/dal";

export type SalePerformanceRow = {
  email: string;
  fullName: string;
  branchCode: string | null;
  /** Số liên hệ Sale này TẠO MỚI trong khoảng thời gian — thước đo "có chăm
   * chỉ làm lead" (chăm sóc/nhập liên hệ đều đặn hay không). */
  created: number;
  /** Số liên hệ Sale này ĐÓNG Đủ tiêu chuẩn (xin được SĐT) trong khoảng. */
  qualified: number;
  /** Số liên hệ Sale này đóng Spam trong khoảng. */
  spam: number;
  /** Tỷ lệ "xin được số điện thoại" trong số liên hệ đã CÓ KẾT QUẢ (Đủ tiêu
   * chuẩn hoặc Spam) trong khoảng — loại các liên hệ còn đang mở (chưa có kết
   * quả) ra khỏi mẫu số vì chưa thể tính là thành hay bại. null nếu chưa đóng
   * liên hệ nào trong khoảng (không đủ dữ liệu để tính tỷ lệ). */
  qualifiedRate: number | null;
};

/** Hiệu suất từng Sale trong `windowDays` ngày gần nhất — dùng chung giữa
 * "Giám sát" (admin/monitoring) và Dashboard Leader để 2 nơi luôn khớp công
 * thức. `qualified`/`spam` tính theo người ĐÓNG (updatedByEmail lúc closedAt),
 * không phải người tạo — người thực sự xin được SĐT/quyết định Spam mới là
 * người đáng được/bị tính, kể cả khi không phải người tạo lead ban đầu. */
export async function computeSalePerformance(actor: CurrentUser, windowDays: number): Promise<SalePerformanceRow[]> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);
  windowStart.setHours(0, 0, 0, 0);

  const salesWhere: Prisma.UserWhereInput = { role: ROLES.SALES, active: true };
  if (!canViewAllBranches(actor)) {
    salesWhere.branchCode = actor.branchCode ?? "__NONE__";
  }

  const [sales, createdCounts, closedGroups] = await Promise.all([
    prisma.user.findMany({ where: salesWhere, select: { email: true, fullName: true, branchCode: true } }),
    prisma.interaction.groupBy({
      by: ["createdByEmail"],
      where: { ...branchScopeWhere(actor), createdLeadAt: { gte: windowStart } },
      _count: { _all: true },
    }),
    prisma.interaction.groupBy({
      by: ["updatedByEmail", "statusName"],
      where: {
        ...branchScopeWhere(actor),
        closedAt: { gte: windowStart },
        statusName: { in: [STATUS.PHONE, STATUS.SPAM] },
        updatedByEmail: { not: null },
      },
      _count: { _all: true },
    }),
  ]);

  const createdByEmail = new Map(createdCounts.map((r) => [r.createdByEmail, r._count._all]));
  const qualifiedByEmail = new Map<string, number>();
  const spamByEmail = new Map<string, number>();
  for (const row of closedGroups) {
    if (!row.updatedByEmail) continue;
    if (row.statusName === STATUS.PHONE) qualifiedByEmail.set(row.updatedByEmail, row._count._all);
    if (row.statusName === STATUS.SPAM) spamByEmail.set(row.updatedByEmail, row._count._all);
  }

  return sales.map((s) => {
    const created = createdByEmail.get(s.email) ?? 0;
    const qualified = qualifiedByEmail.get(s.email) ?? 0;
    const spam = spamByEmail.get(s.email) ?? 0;
    const closed = qualified + spam;
    return { ...s, created, qualified, spam, qualifiedRate: closed > 0 ? Math.round((qualified / closed) * 1000) / 10 : null };
  });
}
