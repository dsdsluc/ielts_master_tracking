import { Sparkles } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { requireRole } from "@/lib/auth/dal";
import { CAN_PUSH_FOLLOWUP, STATUS } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { canAccessBranch } from "@/lib/interactions/scope";
import { listItemInclude } from "@/lib/interactions/serialize";
import { prisma } from "@/lib/prisma";
import { FollowupFilterBar } from "@/app/(app)/followup/followup-filter-bar";
import { FollowupView, type FollowupCandidate } from "@/app/(app)/followup/followup-view";

const STALE_OPTIONS = [3, 7, 14];
const MAX_CANDIDATES = 200;

export default async function FollowupPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; source?: string; status?: string; stale?: string }>;
}) {
  const user = await requireRole(...CAN_PUSH_FOLLOWUP);
  const { branch, source, status, stale } = await searchParams;

  const [branches, sourceRows] = await Promise.all([
    prisma.branch.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
    prisma.source.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  const where: Prisma.InteractionWhereInput = {
    ...branchScopeWhere(user),
    activeFlag: true,
    needsFollowup: false,
    statusName: status && status !== "all" ? status : { in: [STATUS.WAITING, STATUS.PROCESSING] },
  };
  if (branch && branch !== "all" && canAccessBranch(user, branch)) {
    where.assignedBranchCode = branch;
  }
  if (source && source !== "all") {
    where.sourceName = source;
  }

  const staleDays = STALE_OPTIONS.includes(Number(stale)) ? Number(stale) : null;
  if (staleDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - staleDays);
    where.OR = [{ updatedAt: { lte: cutoff } }, { AND: [{ updatedAt: null }, { createdLeadAt: { lte: cutoff } }] }];
  }

  const rows = await prisma.interaction.findMany({
    where,
    include: listItemInclude,
    orderBy: { createdLeadAt: "asc" },
    take: MAX_CANDIDATES,
  });

  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));
  const candidates: FollowupCandidate[] = rows.map((r) => ({
    interactionId: r.interactionId,
    customerName: r.customerName,
    status: r.statusName,
    sourceName: r.sourceName,
    fanpageName: r.fanpageName,
    assignedBranchCode: r.assignedBranchCode,
    assignedSaleName: r.assignedSale?.fullName ?? null,
    createdLeadAt: r.createdLeadAt.toISOString(),
    lastActivityAt: (r.updatedAt ?? r.createdLeadAt).toISOString(),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Chăm sóc lại"
        description='Chọn liên hệ đang mở để gắn cờ "Cần chăm sóc lại" cho Sale, kèm gợi ý chung nếu có.'
      />

      <FollowupFilterBar branches={branches} sources={sourceRows.map((s) => s.name)} />

      {candidates.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Không có liên hệ nào phù hợp"
          description="Không có liên hệ đang mở nào khớp bộ lọc hiện tại, hoặc tất cả đã được gắn cờ chăm sóc lại."
        />
      ) : (
        <FollowupView candidates={candidates} branchNames={branchNames} />
      )}
    </>
  );
}
