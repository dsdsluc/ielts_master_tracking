import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { prisma } from "@/lib/prisma";
import { FollowupAssignView, type FollowupAssignItem } from "@/app/(app)/followup-assign/followup-assign-view";

export default async function FollowupAssignPage() {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "followupAssign");

  const [branches, rows] = await Promise.all([
    prisma.branch.findMany({ select: { code: true, name: true } }),
    prisma.interaction.findMany({
      where: { ...branchScopeWhere(user), activeFlag: true, needsFollowup: true, followupTargetSaleEmail: null },
      select: {
        interactionId: true,
        customerName: true,
        statusName: true,
        assignedBranchCode: true,
        mktSuggestion: true,
        mktPushedAt: true,
        mktPushedBy: { select: { fullName: true } },
      },
      orderBy: { mktPushedAt: "asc" },
    }),
  ]);

  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));
  const items: FollowupAssignItem[] = rows.map((r) => ({
    interactionId: r.interactionId,
    customerName: r.customerName,
    status: r.statusName,
    branchName: branchNames[r.assignedBranchCode] ?? r.assignedBranchCode,
    mktSuggestion: r.mktSuggestion,
    mktPushedAt: r.mktPushedAt!.toISOString(),
    mktPushedByName: r.mktPushedBy?.fullName ?? null,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Leader"
        title="Phân bổ chăm sóc lại"
        description="Yêu cầu Marketing gửi đến, chưa có Sale nào nhận — chọn Sale phụ trách cho từng liên hệ."
      />

      <FollowupAssignView items={items} />
    </>
  );
}
