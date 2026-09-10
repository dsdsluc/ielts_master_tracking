import { TimerOff } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { requireRole } from "@/lib/auth/dal";
import { ROLES, STATUS } from "@/lib/interactions/constants";
import { getSlaHours } from "@/lib/interactions/settings";
import { listItemInclude, toListItem } from "@/lib/interactions/serialize";
import { prisma } from "@/lib/prisma";
import { SlaReviewView, type SlaReviewRow } from "@/app/(app)/admin/sla-review/sla-review-view";

export default async function SlaReviewPage() {
  await requireRole(ROLES.ADMIN);
  const slaHours = await getSlaHours();
  const cutoff = new Date(Date.now() - slaHours * 3600_000);

  const [rows, branches] = await Promise.all([
    prisma.interaction.findMany({
      where: { activeFlag: true, statusName: STATUS.WAITING, createdLeadAt: { lte: cutoff } },
      include: { ...listItemInclude, slaFlaggedBy: { select: { fullName: true } } },
      orderBy: { createdLeadAt: "asc" },
    }),
    prisma.branch.findMany({ select: { code: true, name: true } }),
  ]);
  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));

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
        description={`Liên hệ tạo hơn ${slaHours} giờ trước mà vẫn chưa được liên hệ (còn ở trạng thái Chờ) — chọn để đánh dấu ghi nhận theo dõi. Ngưỡng chỉnh ở "Cấu hình hệ thống".`}
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
