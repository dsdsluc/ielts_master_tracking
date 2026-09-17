import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/kpi-card";
import { getCurrentUser } from "@/lib/auth/dal";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { canAccessBranch } from "@/lib/interactions/scope";
import { prisma } from "@/lib/prisma";
import { FollowupTrackingTable, type FollowupTrackingRow } from "@/app/(app)/followup-tracking/followup-tracking-table";
import { FollowupResolveNotesLog } from "@/app/(app)/followup-tracking/followup-resolve-notes-log";
import { computeFollowupStats } from "@/app/(app)/followup-tracking/stats";
import { loadFollowupResolveNotes } from "@/app/(app)/followup-tracking/notes";

const DAYS_OPTIONS = [7, 30, 90];
const MAX_ROWS = 300;
const UNASSIGNED_KEY = "unassigned";

export default async function FollowupTrackingSalerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ saleKey: string }>;
  searchParams: Promise<{ branch?: string; resolved?: string; days?: string }>;
}) {
  const user = await getCurrentUser();
  const { saleKey: rawSaleKey } = await params;
  const saleKey = decodeURIComponent(rawSaleKey);
  const isUnassigned = saleKey === UNASSIGNED_KEY;
  const { branch, resolved, days } = await searchParams;

  const branches = await prisma.branch.findMany({ select: { code: true, name: true }, orderBy: { name: "asc" } });

  const where: Prisma.InteractionWhereInput = {
    ...branchScopeWhere(user),
    activeFlag: true,
    mktPushedAt: { not: null },
    followupTargetSaleEmail: isUnassigned ? null : saleKey,
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
      followupTargetSaleEmail: true,
      mktPushedBy: { select: { fullName: true } },
      followupHandledBy: { select: { fullName: true } },
      followupTargetSale: { select: { fullName: true } },
    },
    orderBy: { mktPushedAt: "desc" },
    take: MAX_ROWS,
  });

  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));
  const baseRows = rows.map((r) => ({
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
    saleEmail: r.followupTargetSaleEmail,
    saleName: r.followupTargetSale?.fullName ?? null,
  }));

  const resolveNotes = await loadFollowupResolveNotes(baseRows);
  const tableRows: FollowupTrackingRow[] = baseRows.map((r) => ({
    ...r,
    resolveNote: resolveNotes[r.interactionId] ?? null,
  }));

  const stats = computeFollowupStats(tableRows);
  const saleName = isUnassigned ? "Chưa gán Sale" : (tableRows[0]?.saleName ?? saleKey);

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          className="rounded-full"
          nativeButton={false}
          render={<Link href="/followup-tracking" />}
          aria-label="Quay lại Theo dõi hiệu quả chăm sóc lại"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex flex-col gap-0.5">
          <span className="font-condensed text-xs font-semibold tracking-wide text-primary uppercase">
            Marketing · Theo dõi hiệu quả chăm sóc lại
          </span>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{saleName}</h1>
          {!isUnassigned && <p className="font-mono text-xs text-muted-foreground">{saleKey}</p>}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Được giao" value={stats.total} accentClassName="bg-foreground/50" />
        <KpiCard label="Đang chờ xử lý" value={stats.pending} accentClassName="bg-status-waiting" />
        <KpiCard label="Đã xử lý" value={stats.resolvedCount} accentClassName="bg-status-qualified" />
        <KpiCard label="Thời gian xử lý TB" value={stats.avgResolveLabel} accentClassName="bg-primary" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Chuyển đổi thật (ra SĐT)" value={stats.convertedCount} accentClassName="bg-status-qualified" />
        <KpiCard label="Tỷ lệ chuyển đổi" value={`${stats.conversionRate.toFixed(1)}%`} accentClassName="bg-status-qualified" />
        <KpiCard label="Spam trong chăm sóc lại" value={stats.spamCount} accentClassName="bg-destructive" />
        <KpiCard label="Đóng thủ công (không rõ kết quả)" value={stats.manualDismissCount} accentClassName="bg-muted-foreground/40" />
      </div>

      <FollowupResolveNotesLog rows={tableRows} />

      <FollowupTrackingTable rows={tableRows} branchNames={branchNames} />
    </>
  );
}
