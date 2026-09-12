import { TimerOff } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { requireRole } from "@/lib/auth/dal";
import { ROLES, STATUS } from "@/lib/interactions/constants";
import { getBranchSlaMap } from "@/lib/interactions/queries";
import { listItemInclude, toListItem } from "@/lib/interactions/serialize";
import { prisma } from "@/lib/prisma";
import { SlaReviewView, type SlaReviewRow } from "@/app/(app)/admin/sla-review/sla-review-view";

export default async function SlaReviewPage() {
  await requireRole(ROLES.ADMIN);
  const { byCode: slaByBranch, fallback: slaFallback } = await getBranchSlaMap();

  // Ngưỡng khác nhau theo từng cơ sở (Branch.slaReceiveMinutes) nên không thể
  // lọc bằng 1 WHERE ngày duy nhất — lấy toàn bộ liên hệ đang Chờ rồi so với
  // ngưỡng riêng của cơ sở đó trong JS (mirror getQueue() ở lib/interactions/queries.ts).
  const now = Date.now();
  const [allWaiting, branches] = await Promise.all([
    prisma.interaction.findMany({
      where: { activeFlag: true, statusName: STATUS.WAITING },
      include: { ...listItemInclude, slaFlaggedBy: { select: { fullName: true } } },
      orderBy: { createdLeadAt: "asc" },
    }),
    prisma.branch.findMany({ select: { code: true, name: true } }),
  ]);
  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));

  const rows = allWaiting.filter((r) => {
    const sla = slaByBranch.get(r.assignedBranchCode) ?? slaFallback;
    const cutoff = now - sla.slaReceiveMinutes * 60_000;
    return r.createdLeadAt.getTime() <= cutoff;
  });

  const items: SlaReviewRow[] = rows.map((r) => ({
    ...toListItem(r),
    slaFlagged: r.slaFlagged,
    slaFlaggedAt: r.slaFlaggedAt?.toISOString() ?? null,
    slaFlaggedByName: r.slaFlaggedBy?.fullName ?? null,
  }));

  const unflaggedCount = items.filter((i) => !i.slaFlagged).length;

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Rà soát SLA"
        description='Liên hệ vẫn chưa được liên hệ (còn ở trạng thái Chờ) quá "SLA nhận" của cơ sở phụ trách — chọn để đánh dấu ghi nhận theo dõi. Ngưỡng chỉnh theo từng cơ sở ở "Cơ sở".'
      />

      {items.length === 0 ? (
        <EmptyState
          icon={TimerOff}
          title="Không có liên hệ nào quá hạn"
          description="Mọi liên hệ mới đều đang trong ngưỡng SLA hiện tại."
        />
      ) : (
        <SlaReviewView items={items} unflaggedCount={unflaggedCount} branchNames={branchNames} />
      )}
    </>
  );
}
