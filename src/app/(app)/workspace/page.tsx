import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/dal";
import { ROLES, STATUS } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { listItemInclude, toListItem } from "@/lib/interactions/serialize";
import { prisma } from "@/lib/prisma";
import { WorkspaceView } from "@/app/(app)/workspace/workspace-view";

export default async function WorkspacePage() {
  const user = await requireRole(ROLES.SALES, ROLES.LEADER, ROLES.ADMIN);

  // Chỉ những liên hệ "chưa đóng" (chưa Đủ tiêu chuẩn/Spam) mới còn cần chọn
  // Sale phụ trách — liên hệ đã đóng không có ý nghĩa để thêm vào Workspace.
  const openStatusWhere: Prisma.InteractionWhereInput = {
    activeFlag: true,
    statusName: { in: [STATUS.WAITING, STATUS.PROCESSING] },
  };

  const [availableRows, workspaceRows] = await Promise.all([
    // Hàng đợi chung: liên hệ đang mở và CHƯA được Sale nào thêm vào Workspace.
    prisma.interaction.findMany({
      where: { ...branchScopeWhere(user), ...openStatusWhere, workspaceClaimedByEmail: null },
      include: listItemInclude,
      orderBy: { createdLeadAt: "asc" },
    }),
    // Workspace của chính actor — liên hệ actor đã thêm và chưa giải phóng/đóng.
    prisma.interaction.findMany({
      where: { ...openStatusWhere, workspaceClaimedByEmail: user.email },
      include: listItemInclude,
      orderBy: { createdLeadAt: "asc" },
    }),
  ]);

  const items = availableRows.map(toListItem);
  const initialWorkspace = workspaceRows.map(toListItem);

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Workspace của tôi"
        description="Chọn liên hệ từ hàng đợi chung để thêm vào không gian làm việc riêng — liên hệ đã thêm sẽ bị khoá khỏi Workspace của Sale khác cho đến khi được giải phóng."
      />
      <WorkspaceView items={items} initialWorkspace={initialWorkspace} />
    </>
  );
}
