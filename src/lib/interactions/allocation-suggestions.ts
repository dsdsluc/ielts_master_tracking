import "server-only";
// Gợi ý phân bổ khách hàng cho Sale — đưa tỷ lệ chốt (Đã chốt ÷ Tổng được
// phân bổ) của từng Sale về khoảng mục tiêu 50–60%. Ý tưởng: tỷ lệ chốt CAO
// hơn khoảng mục tiêu nghĩa là Sale đang "dư sức" so với khối lượng đang có
// (họ chốt tốt hơn mức kỳ vọng) — Leader nên giao thêm khách để tận dụng, số
// khách thêm vào sẽ tự nhiên kéo tỷ lệ về gần mục tiêu (chốt vẫn giữ nguyên,
// mẫu số tăng lên). Tỷ lệ THẤP hơn khoảng mục tiêu nghĩa là Sale đang gặp khó
// khăn — Leader nên hỗ trợ/kèm cặp trước, KHÔNG giao thêm việc lúc này.
import { prisma } from "@/lib/prisma";
import { SALE_LIKE_ROLES, CUSTOMER_STAGE } from "@/lib/interactions/constants";

export const ALLOCATION_TARGET_MIN = 50;
export const ALLOCATION_TARGET_MAX = 60;

// Mẫu quá nhỏ (vd 1 khách, chốt 1 = 100%) không đủ tin cậy để ra gợi ý — chờ
// có ít nhất ngần này khách trong tay mới bắt đầu đánh giá tỷ lệ.
const MIN_SAMPLE_SIZE = 5;

export type AllocationSuggestionKind = "increase" | "support" | "balanced" | "insufficient_data";

export type SaleAllocationSuggestion = {
  email: string;
  fullName: string;
  totalAssigned: number;
  enrolled: number;
  closeRate: number;
  kind: AllocationSuggestionKind;
  // Chỉ có giá trị khi kind = "increase" — số khách gợi ý giao THÊM để tỷ lệ
  // chốt tiến về đúng điểm giữa khoảng mục tiêu (55%), giả định số đã chốt
  // giữ nguyên trong lúc chờ khách mới được xử lý.
  suggestedAdditional: number | null;
};

function classify(totalAssigned: number, enrolled: number): { kind: AllocationSuggestionKind; suggestedAdditional: number | null } {
  if (totalAssigned < MIN_SAMPLE_SIZE) return { kind: "insufficient_data", suggestedAdditional: null };

  const closeRate = (enrolled / totalAssigned) * 100;
  if (closeRate > ALLOCATION_TARGET_MAX) {
    const targetMidRatio = (ALLOCATION_TARGET_MIN + ALLOCATION_TARGET_MAX) / 2 / 100;
    const neededTotal = Math.ceil(enrolled / targetMidRatio);
    return { kind: "increase", suggestedAdditional: Math.max(1, neededTotal - totalAssigned) };
  }
  if (closeRate < ALLOCATION_TARGET_MIN) return { kind: "support", suggestedAdditional: null };
  return { kind: "balanced", suggestedAdditional: null };
}

const KIND_PRIORITY: Record<AllocationSuggestionKind, number> = { increase: 0, support: 1, balanced: 2, insufficient_data: 3 };

/** Gợi ý phân bổ cho MỌI Sale đang hoạt động và đang có ít nhất 1 khách hàng
 * — "Tổng được phân bổ" tính trên toàn bộ khách hàng CURRENT thuộc Sale đó
 * (assignedToEmail), không tách theo tháng, vì đây là ảnh chụp "sổ khách
 * đang cầm" tại thời điểm xem, dùng để quyết định NGAY, không phải báo cáo
 * kỳ. Sắp increase/support lên đầu để Leader thấy ngay ai cần xử lý. */
export async function getSaleAllocationSuggestions(): Promise<SaleAllocationSuggestion[]> {
  const [sales, assignedGroups, enrolledGroups] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: SALE_LIKE_ROLES }, active: true }, select: { email: true, fullName: true } }),
    prisma.customer.groupBy({ by: ["assignedToEmail"], where: { assignedToEmail: { not: null } }, _count: { _all: true } }),
    prisma.customer.groupBy({
      by: ["assignedToEmail"],
      where: { assignedToEmail: { not: null }, stage: CUSTOMER_STAGE.ENROLLED },
      _count: { _all: true },
    }),
  ]);

  const totalByEmail = new Map(assignedGroups.map((g) => [g.assignedToEmail as string, g._count._all]));
  const enrolledByEmail = new Map(enrolledGroups.map((g) => [g.assignedToEmail as string, g._count._all]));

  return sales
    .map((s) => {
      const totalAssigned = totalByEmail.get(s.email) ?? 0;
      const enrolled = enrolledByEmail.get(s.email) ?? 0;
      const { kind, suggestedAdditional } = classify(totalAssigned, enrolled);
      return {
        email: s.email,
        fullName: s.fullName,
        totalAssigned,
        enrolled,
        closeRate: totalAssigned > 0 ? (enrolled / totalAssigned) * 100 : 0,
        kind,
        suggestedAdditional,
      };
    })
    .filter((r) => r.totalAssigned > 0)
    .sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] || b.totalAssigned - a.totalAssigned);
}
