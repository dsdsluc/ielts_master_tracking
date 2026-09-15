import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { CheckCircle2, ChevronRight, GraduationCap, PhoneCall, Sparkles, UserRoundPlus, Users2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { CAN_REASSIGN, STATUS } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { computeSalePerformance } from "@/lib/interactions/sale-performance";
import { prisma } from "@/lib/prisma";
import { computeFollowupStats, type FollowupStatRow } from "@/app/(app)/followup-tracking/stats";
import { computeMonthlyKpiProgress, computeTeamPersonalKpi } from "@/lib/students/stats";

const ACTIVITY_WINDOW_DAYS = 30;

function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function formatKpiMonth(month: string) {
  const [y, m] = month.split("-");
  return `${m}/${y}`;
}

export default async function LeaderDashboardPage() {
  const actor = await requireRole(...CAN_REASSIGN);

  const followupWhere: Prisma.InteractionWhereInput = {
    ...branchScopeWhere(actor),
    activeFlag: true,
    mktPushedAt: { not: null },
  };

  const [followupRows, unassignedStudentCount, teamKpi, companyKpi, perf] = await Promise.all([
    prisma.interaction.findMany({
      where: followupWhere,
      select: { needsFollowup: true, followupOutcome: true, statusName: true, followupHandledAt: true, mktPushedAt: true },
    }),
    prisma.interaction.count({
      where: { ...branchScopeWhere(actor), activeFlag: true, statusName: STATUS.PHONE, studentProfiles: { none: {} } },
    }),
    computeTeamPersonalKpi(actor),
    computeMonthlyKpiProgress(actor),
    computeSalePerformance(actor, ACTIVITY_WINDOW_DAYS),
  ]);

  const followupStatRows: FollowupStatRow[] = followupRows.map((r) => ({
    needsFollowup: r.needsFollowup,
    followupOutcome: r.followupOutcome,
    status: r.statusName,
    followupHandledAt: r.followupHandledAt?.toISOString() ?? null,
    mktPushedAt: r.mktPushedAt!.toISOString(),
  }));
  const followupStats = computeFollowupStats(followupStatRows);

  const kpiRows = [...teamKpi.rows].sort((a, b) => (a.met === b.met ? b.remaining - a.remaining : a.met ? 1 : -1));
  const salesShortOfKpi = teamKpi.rows.filter((r) => !r.met).length;

  const activityRows = [...perf].sort((a, b) => b.created - a.created);
  const idleSales = perf.filter((r) => r.created === 0).length;

  return (
    <>
      <PageHeader
        eyebrow="Leader"
        title="Dashboard Leader"
        description="Tổng quan để quản trị đội Sale — chăm sóc lại, phân bổ học viên, chỉ tiêu KPI và mức độ chăm chỉ làm lead."
      />

      <div className="flex flex-col gap-10">
        <section>
          <SectionHeader
            icon={Sparkles}
            title="Chăm sóc lại (Marketing)"
            description='Tổng quan yêu cầu "Cần chăm sóc lại" Marketing đã gửi cho Sale.'
            action={
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-full" nativeButton={false} render={<Link href="/followup-assign" />}>
                  <Sparkles className="size-3.5" /> Phân bổ ngay
                </Button>
                <Button variant="outline" size="sm" className="rounded-full" nativeButton={false} render={<Link href="/followup-tracking" />}>
                  Xem chi tiết <ChevronRight className="size-3.5" />
                </Button>
              </div>
            }
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Đã gửi" value={followupStats.total} accentClassName="bg-foreground/50" href="/followup-tracking" />
            <KpiCard
              label="Đang chờ xử lý"
              value={followupStats.pending}
              accentClassName="bg-status-waiting"
              href="/followup-tracking?resolved=pending"
            />
            <KpiCard
              label="Đã xử lý"
              value={followupStats.resolvedCount}
              accentClassName="bg-status-qualified"
              href="/followup-tracking?resolved=resolved"
            />
            <KpiCard
              label="Chuyển đổi thật (ra SĐT)"
              value={`${followupStats.conversionRate.toFixed(1)}%`}
              accentClassName="bg-status-qualified"
              href="/followup-tracking?resolved=resolved"
            />
          </div>
        </section>

        <section>
          <SectionHeader
            icon={GraduationCap}
            title="Phân bổ học viên"
            description="Học viên chưa được phân bổ và chỉ tiêu KPI từng Sale trong tháng."
            action={
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-full" nativeButton={false} render={<Link href="/student-assignment" />}>
                  <UserRoundPlus className="size-3.5" /> Phân bổ ngay
                </Button>
                <Button variant="outline" size="sm" className="rounded-full" nativeButton={false} render={<Link href="/student-assignment/stats" />}>
                  Xem chi tiết <ChevronRight className="size-3.5" />
                </Button>
              </div>
            }
          />

          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Chưa phân bổ"
              value={unassignedStudentCount}
              accentClassName={unassignedStudentCount > 0 ? "bg-destructive" : "bg-status-qualified"}
              href="/student-assignment"
            />
            <KpiCard
              label={`Đã chốt tháng ${formatKpiMonth(companyKpi.month)}`}
              value={companyKpi.enrolled}
              accentClassName="bg-status-qualified"
              href="/student-assignment/stats"
            />
            <KpiCard label="Chỉ tiêu công ty tháng này" value={companyKpi.target} accentClassName="bg-primary" href="/student-assignment/stats" />
            <KpiCard
              label="Sale thiếu KPI"
              value={salesShortOfKpi}
              accentClassName={salesShortOfKpi > 0 ? "bg-destructive" : "bg-status-qualified"}
              href="#kpi-theo-sale"
            />
          </div>

          <div id="kpi-theo-sale" className="shadow-bubble scroll-mt-6 overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="border-b border-border/70 px-5 py-3.5">
              <h3 className="text-sm font-semibold text-foreground">Chỉ tiêu cá nhân theo Sale — tháng {formatKpiMonth(teamKpi.month)}</h3>
              <p className="text-xs text-muted-foreground">
                Chỉ tiêu cá nhân = chỉ tiêu công ty ({teamKpi.companyTarget}) × tỷ trọng học viên được phân bổ trên tổng {teamKpi.totalAssigned} học
                viên toàn công ty tháng này.
              </p>
            </div>
            {kpiRows.length === 0 ? (
              <EmptyState icon={Users2} title="Chưa có Sale nào được phân bổ học viên tháng này" description="Chỉ tiêu cá nhân sẽ xuất hiện khi có học viên được phân bổ." />
            ) : (
              <Table>
                <TableHeader className="bg-secondary/60">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Sale</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Được giao</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Chỉ tiêu</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đã chốt</TableHead>
                    <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpiRows.map((row) => (
                    <TableRow key={row.email} className="odd:bg-secondary/10">
                      <TableCell className="min-w-40 px-5 py-3">
                        <Link
                          href={`/student-assignment/stats?sale=${encodeURIComponent(row.email)}`}
                          className="block truncate font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {row.fullName}
                        </Link>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{row.email}</p>
                      </TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-muted-foreground">{row.mineAssigned}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-foreground">{row.personalTarget}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-foreground">{row.enrolled}</TableCell>
                      <TableCell className="px-4">
                        {row.met ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-status-qualified-bg px-2.5 py-0.5 text-xs font-medium text-status-qualified">
                            <CheckCircle2 className="size-3.5" /> Đủ KPI
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                            Thiếu {row.remaining}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>

        <section>
          <SectionHeader
            icon={PhoneCall}
            title="Sale có chăm chỉ làm lead không?"
            description={`Hoạt động tạo liên hệ và tỷ lệ xin được số điện thoại trong ${ACTIVITY_WINDOW_DAYS} ngày gần nhất.`}
          />

          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-2">
            <KpiCard label="Sale chưa tạo lead nào" value={idleSales} accentClassName={idleSales > 0 ? "bg-destructive" : "bg-status-qualified"} />
            <KpiCard label="Tổng Sale đang hoạt động" value={perf.length} accentClassName="bg-foreground/50" />
          </div>

          <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
            {activityRows.length === 0 ? (
              <EmptyState icon={Users2} title="Chưa có Sale nào trong phạm vi" description="Thêm tài khoản Sale ở Trung tâm quản trị." />
            ) : (
              <Table>
                <TableHeader className="bg-secondary/60">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Sale</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tạo mới</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đủ tiêu chuẩn</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Spam</TableHead>
                    <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tỷ lệ xin được SĐT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityRows.map((row) => (
                    <TableRow key={row.email} className="odd:bg-secondary/10">
                      <TableCell className="min-w-40 px-5 py-3">
                        <p className="truncate font-medium text-foreground">{row.fullName}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{row.email}</p>
                      </TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm">
                        {row.created === 0 ? <span className="text-destructive">0</span> : <span className="text-foreground">{row.created}</span>}
                      </TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-status-qualified">{row.qualified}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-status-spam">{row.spam}</TableCell>
                      <TableCell className="px-4">
                        {row.qualifiedRate === null ? (
                          <span className="text-xs text-muted-foreground">Chưa có dữ liệu</span>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-medium ${
                              row.qualifiedRate >= 30
                                ? "bg-status-qualified-bg text-status-qualified"
                                : row.qualifiedRate >= 10
                                  ? "bg-status-received-bg text-status-received"
                                  : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {row.qualifiedRate}%
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
