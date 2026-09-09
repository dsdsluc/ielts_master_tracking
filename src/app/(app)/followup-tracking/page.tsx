import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { requireRole } from "@/lib/auth/dal";
import { CAN_PUSH_FOLLOWUP, FOLLOWUP_OUTCOME, STATUS } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { canAccessBranch } from "@/lib/interactions/scope";
import { prisma } from "@/lib/prisma";
import { FollowupTrackingFilterBar } from "@/app/(app)/followup-tracking/followup-tracking-filter-bar";
import { FollowupTrackingTable, type FollowupTrackingRow } from "@/app/(app)/followup-tracking/followup-tracking-table";

const DAYS_OPTIONS = [7, 30, 90];
const MAX_ROWS = 300;

export default async function FollowupTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; resolved?: string; days?: string }>;
}) {
  const user = await requireRole(...CAN_PUSH_FOLLOWUP);
  const { branch, resolved, days } = await searchParams;

  const branches = await prisma.branch.findMany({ select: { code: true, name: true }, orderBy: { name: "asc" } });

  const where: Prisma.InteractionWhereInput = {
    ...branchScopeWhere(user),
    activeFlag: true,
    mktPushedAt: { not: null },
  };
  if (branch && branch !== "all" && canAccessBranch(user, branch)) {
    where.assignedBranchCode = branch;
  }
  if (resolved === "pending") where.needsFollowup = true;
  if (resolved === "resolved") where.needsFollowup = false;

  const daysNum = DAYS_OPTIONS.includes(Number(days)) ? Number(days) : null;
  if (daysNum) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysNum);
    where.mktPushedAt = { not: null, gte: cutoff };
  }

  const rows = await prisma.interaction.findMany({
    where,
    select: {
      interactionId: true,
      customerName: true,
      statusName: true,
      assignedBranchCode: true,
      needsFollowup: true,
      mktPushedAt: true,
      mktSuggestion: true,
      followupHandledAt: true,
      followupOutcome: true,
      followupResolvedCount: true,
      mktPushedBy: { select: { fullName: true } },
      followupHandledBy: { select: { fullName: true } },
    },
    orderBy: { mktPushedAt: "desc" },
    take: MAX_ROWS,
  });

  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));
  const tableRows: FollowupTrackingRow[] = rows.map((r) => ({
    interactionId: r.interactionId,
    customerName: r.customerName,
    status: r.statusName,
    assignedBranchCode: r.assignedBranchCode,
    mktSuggestion: r.mktSuggestion,
    mktPushedAt: r.mktPushedAt!.toISOString(),
    mktPushedByName: r.mktPushedBy?.fullName ?? null,
    needsFollowup: r.needsFollowup,
    followupHandledAt: r.followupHandledAt?.toISOString() ?? null,
    followupHandledByName: r.followupHandledBy?.fullName ?? null,
    followupOutcome: r.followupOutcome,
    followupResolvedCount: r.followupResolvedCount,
  }));

  const total = tableRows.length;
  const pending = tableRows.filter((r) => r.needsFollowup).length;
  const resolvedCount = total - pending;
  const resolvedRate = total > 0 ? (resolvedCount / total) * 100 : 0;
  // Chuyển đổi thật = có đổi trạng thái nghiệp vụ sau khi được nhắc (không phải
  // chỉ bấm "đã xử lý") VÀ trạng thái hiện tại là "Đủ tiêu chuẩn" (đã lấy SĐT).
  const convertedCount = tableRows.filter(
    (r) => r.followupOutcome === FOLLOWUP_OUTCOME.STATUS_CHANGED && r.status === STATUS.PHONE
  ).length;
  const conversionRate = total > 0 ? (convertedCount / total) * 100 : 0;
  // Spam trong chăm sóc lại = liên hệ đang được nhắc chăm sóc lại mà cuối cùng
  // đóng Spam — bất kể Sale tự tay đóng Spam ngay trong lúc xử lý (outcome
  // STATUS_CHANGED) hay bị hệ thống tự động chuyển vì vượt số lần cấu hình
  // (outcome MANUAL_DISMISS, xem resolveFollowup() trong mutations.ts). Đây là
  // 1 kết quả rõ ràng — không tính vào "đóng thủ công không rõ kết quả".
  const spamCount = tableRows.filter((r) => r.status === STATUS.SPAM).length;
  const spamRate = total > 0 ? (spamCount / total) * 100 : 0;
  const manualDismissCount = tableRows.filter(
    (r) => r.followupOutcome === FOLLOWUP_OUTCOME.MANUAL_DISMISS && r.status !== STATUS.SPAM
  ).length;
  const resolvedDurationsHours = tableRows
    .filter((r) => r.followupHandledAt)
    .map((r) => (new Date(r.followupHandledAt as string).getTime() - new Date(r.mktPushedAt).getTime()) / 3600000);
  const avgResolveHours =
    resolvedDurationsHours.length > 0 ? resolvedDurationsHours.reduce((a, b) => a + b, 0) / resolvedDurationsHours.length : null;
  const avgResolveLabel = avgResolveHours == null ? "—" : avgResolveHours < 24 ? `${Math.round(avgResolveHours)} giờ` : `${(avgResolveHours / 24).toFixed(1)} ngày`;

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Theo dõi hiệu quả chăm sóc lại"
        description='Kết quả các yêu cầu "Cần chăm sóc lại" đã gửi cho Sale — ai đã xử lý, ai chưa.'
      />

      <FollowupTrackingFilterBar branches={branches} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Đã gửi" value={total} accentClassName="bg-foreground/50" />
        <KpiCard label="Đang chờ xử lý" value={pending} accentClassName="bg-status-waiting" />
        <KpiCard label="Đã xử lý" value={resolvedCount} accentClassName="bg-status-qualified" />
        <KpiCard label="Thời gian xử lý TB" value={avgResolveLabel} accentClassName="bg-primary" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Chuyển đổi thật (ra SĐT)" value={convertedCount} accentClassName="bg-status-qualified" />
        <KpiCard label="Tỷ lệ chuyển đổi" value={`${conversionRate.toFixed(1)}%`} accentClassName="bg-status-qualified" />
        <KpiCard label="Spam trong chăm sóc lại" value={spamCount} accentClassName="bg-destructive" />
        <KpiCard label="Đóng thủ công (không rõ kết quả)" value={manualDismissCount} accentClassName="bg-muted-foreground/40" />
      </div>

      {total > 0 && (
        <p className="mb-4 text-xs text-muted-foreground">
          Tỷ lệ đã xử lý: <strong className="font-mono text-foreground">{resolvedRate.toFixed(1)}%</strong> · Chuyển đổi thật (ra SĐT) chiếm{" "}
          <strong className="font-mono text-foreground">{conversionRate.toFixed(1)}%</strong> · Spam sau khi được nhắc chiếm{" "}
          <strong className="font-mono text-foreground">{spamRate.toFixed(1)}%</strong> tổng số đã gửi.
        </p>
      )}

      <FollowupTrackingTable rows={tableRows} branchNames={branchNames} />
    </>
  );
}
