import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/dal";
import { CAN_CREATE_OR_EDIT_LEAD } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { getMaxFollowupBeforeSpam } from "@/lib/interactions/settings";
import { prisma } from "@/lib/prisma";
import { FollowupInboxView, type FollowupInboxItem } from "@/app/(app)/followup-inbox/followup-inbox-view";

export default async function FollowupInboxPage() {
  const user = await requireRole(...CAN_CREATE_OR_EDIT_LEAD);

  const [branches, rows, maxBeforeSpam] = await Promise.all([
    prisma.branch.findMany({ select: { code: true, name: true } }),
    prisma.interaction.findMany({
      where: { ...branchScopeWhere(user), activeFlag: true, needsFollowup: true },
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
        workspaceClaimedByEmail: true,
        workspaceClaimedBy: { select: { fullName: true } },
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
    consultantEmail: r.assignedSaleEmail ?? r.workspaceClaimedByEmail,
    consultantName: r.assignedSale?.fullName ?? r.workspaceClaimedBy?.fullName ?? null,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Cần chăm sóc lại"
        description="Các liên hệ Marketing yêu cầu bạn chăm sóc lại — xử lý xong thì đánh dấu để tắt nhắc."
      />

      <FollowupInboxView items={items} currentUserEmail={user.email} currentUserName={user.fullName} />
    </>
  );
}
