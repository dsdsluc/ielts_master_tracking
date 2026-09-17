import type { Prisma } from "@/generated/prisma/client";
import { ShieldOff } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { STATUS } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { getLatestSpamReasons, spamReasonLabel } from "@/app/(app)/admin/spam-reason";
import { SpamReviewFilterBar } from "@/app/(app)/admin/spam-review/spam-review-filter-bar";
import { SpamReviewView, type SpamCandidate } from "@/app/(app)/admin/spam-review/spam-review-view";

const MAX_CANDIDATES = 200;

export default async function SpamReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; source?: string }>;
}) {
  const user = await getCurrentUser();
  await requireFeatureAccess(user.role, "spamReview");
  const { branch, source } = await searchParams;

  const [branches, sourceRows] = await Promise.all([
    prisma.branch.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
    prisma.source.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  const where: Prisma.InteractionWhereInput = { statusName: STATUS.SPAM };
  if (branch && branch !== "all") where.assignedBranchCode = branch;
  if (source && source !== "all") where.sourceName = source;

  const rows = await prisma.interaction.findMany({
    where,
    select: {
      interactionId: true,
      customerName: true,
      sourceName: true,
      fanpageName: true,
      assignedBranchCode: true,
      closedAt: true,
      conversationLink: true,
      rawLink: true,
      updatedBy: { select: { fullName: true } },
    },
    orderBy: { closedAt: "desc" },
    take: MAX_CANDIDATES,
  });

  const reasonByInteraction = await getLatestSpamReasons(rows.map((r) => r.interactionId));
  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));

  const candidates: SpamCandidate[] = rows.map((r) => ({
    interactionId: r.interactionId,
    customerName: r.customerName,
    sourceName: r.sourceName,
    fanpageName: r.fanpageName,
    assignedBranchCode: r.assignedBranchCode,
    closedByName: r.updatedBy?.fullName ?? null,
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    spamReasonLabel: spamReasonLabel(reasonByInteraction.get(r.interactionId)?.code ?? null) || "Không rõ",
    conversationLink: r.conversationLink,
    rawLink: r.rawLink,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Xử lý Spam"
        description='Xoá hẳn liên hệ rác, hoặc khôi phục về "Tiếp nhận" và gửi ngay vào hàng đợi "Cần chăm sóc lại" cho Leader phân bổ.'
      />

      <SpamReviewFilterBar branches={branches} sources={sourceRows.map((s) => s.name)} />

      {candidates.length === 0 ? (
        <EmptyState
          icon={ShieldOff}
          title="Không có liên hệ Spam nào"
          description="Không có liên hệ Spam nào khớp bộ lọc hiện tại."
        />
      ) : (
        <SpamReviewView candidates={candidates} branchNames={branchNames} />
      )}
    </>
  );
}
