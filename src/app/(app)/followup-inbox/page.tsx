import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { ROLES } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { getMaxFollowupBeforeSpam } from "@/lib/interactions/settings";
import { prisma } from "@/lib/prisma";
import { FollowupInboxView, type FollowupInboxItem } from "@/app/(app)/followup-inbox/followup-inbox-view";

export default async function FollowupInboxPage() {
  const user = await getCurrentUser();
  await requireFeatureAccess(user.role, "followupInbox");

  // Sale chỉ thấy đúng yêu cầu Marketing/Leader nhắm tới email của họ — không
  // còn là hàng đợi chung toàn cơ sở. Leader/Admin vẫn xem toàn bộ (theo phạm
  // vi cơ sở) để có cái nhìn giám sát/backup.
  const [branches, rows, maxBeforeSpam] = await Promise.all([
    prisma.branch.findMany({ select: { code: true, name: true } }),
    prisma.interaction.findMany({
      where: {
        ...branchScopeWhere(user),
        activeFlag: true,
        needsFollowup: true,
        ...(user.role === ROLES.SALES ? { followupTargetSaleEmail: user.email } : {}),
      },
      select: {
        interactionId: true,
        customerName: true,
        statusName: true,
        assignedBranchCode: true,
        mktSuggestion: true,
        mktPushedAt: true,
        mktPushedBy: { select: { fullName: true } },
        followupResolvedCount: true,
        assignedSaleEmail: true,
        assignedSale: { select: { fullName: true } },
      },
      orderBy: { mktPushedAt: "asc" },
    }),
    getMaxFollowupBeforeSpam(),
  ]);

  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));
  const items: FollowupInboxItem[] = rows.map((r) => ({
    interactionId: r.interactionId,
    customerName: r.customerName,
    status: r.statusName,
    branchName: branchNames[r.assignedBranchCode] ?? r.assignedBranchCode,
    mktSuggestion: r.mktSuggestion,
    mktPushedAt: r.mktPushedAt!.toISOString(),
    mktPushedByName: r.mktPushedBy?.fullName ?? null,
    followupResolvedCount: r.followupResolvedCount,
    maxBeforeSpam,
    consultantEmail: r.assignedSaleEmail,
    consultantName: r.assignedSale?.fullName ?? null,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Cần chăm sóc lại"
        description="Các liên hệ Marketing yêu cầu bạn chăm sóc lại — xử lý xong thì đánh dấu để tắt nhắc."
      />

      <FollowupInboxView items={items} currentUserEmail={user.email} />
    </>
  );
}
