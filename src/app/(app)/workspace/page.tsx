import type { Prisma } from "@/generated/prisma/client";
import { GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/dal";
import { ROLES, STATUS } from "@/lib/interactions/constants";
import { listItemInclude, toListItem } from "@/lib/interactions/serialize";
import { prisma } from "@/lib/prisma";
import { computeSalePersonalKpi } from "@/lib/students/stats";
import { WorkspaceView } from "@/app/(app)/workspace/workspace-view";
import { WorkspaceKpiCard } from "@/app/(app)/workspace/workspace-kpi-card";
import { StudentsSection } from "@/app/(app)/students/students-section";

export default async function WorkspacePage() {
  const user = await requireRole(ROLES.SALES, ROLES.LEADER, ROLES.ADMIN);

  // Chỉ những liên hệ "chưa đóng" (chưa Đủ tiêu chuẩn/Spam) mới còn nằm trong
  // Workspace — liên hệ đã đóng không có ý nghĩa để giữ ở đây nữa.
  const openStatusWhere: Prisma.InteractionWhereInput = {
    activeFlag: true,
    statusName: { in: [STATUS.WAITING, STATUS.PROCESSING] },
  };

  const [workspaceRows, kpi] = await Promise.all([
    // Workspace của chính actor — liên hệ actor đã thêm (từ trang Liên hệ) và
    // chưa giải phóng/đóng. Loại needsFollowup:true — liên hệ "Cần chăm sóc
    // lại" chỉ xử lý ở /followup-inbox, tránh 2 nơi cùng là chỗ Sale làm việc
    // trên 1 liên hệ (mirror buildInteractionWhere() ở lib/interactions/queries.ts).
    prisma.interaction.findMany({
      where: { ...openStatusWhere, needsFollowup: false, workspaceClaimedByEmail: user.email },
      include: listItemInclude,
      orderBy: { createdLeadAt: "asc" },
    }),
    computeSalePersonalKpi(user.email),
  ]);

  const initialWorkspace = workspaceRows.map(toListItem);

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Workspace của tôi"
        description="Theo dõi liên hệ bạn đang xử lý và học viên đang được phân bổ tư vấn."
      />
      <WorkspaceKpiCard kpi={kpi} />
      <WorkspaceView initialWorkspace={initialWorkspace} />

      <div className="mt-8 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <GraduationCap className="size-4 text-status-received" />
          <h2 className="font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Học viên đang tư vấn</h2>
        </div>
        <StudentsSection actor={user} />
      </div>
    </>
  );
}
