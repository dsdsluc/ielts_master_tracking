import { Sparkles, Users2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { currentKpiMonth } from "@/lib/interactions/settings";
import { getFollowupDetail } from "@/lib/admin/monthly-report";
import { monthLabel } from "@/app/(app)/admin/monthly-report/month-utils";
import { DetailMonthNav } from "@/app/(app)/admin/monthly-report/detail-month-nav";

const MONTH_RE = /^\d{4}-\d{2}$/;

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default async function FollowupDetailPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "monthlyReport");

  const { month: monthParam } = await searchParams;
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : currentKpiMonth();

  const { overall, salerSummaries } = await getFollowupDetail(month);

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Chi tiết chăm sóc lại"
        description={`${monthLabel(month)} — hiệu suất xử lý yêu cầu "Cần chăm sóc lại" theo từng Sale được giao.`}
        action={<DetailMonthNav month={month} basePath="/admin/monthly-report/followup" />}
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Đã gửi" value={overall.total} accentClassName="bg-foreground/50" />
        <KpiCard label="Đang chờ xử lý" value={overall.pending} accentClassName="bg-status-waiting" />
        <KpiCard label="Đã xử lý" value={overall.resolvedCount} accentClassName="bg-status-qualified" />
        <KpiCard label="Chuyển đổi thật" value={pct(overall.conversionRate)} accentClassName="bg-status-qualified" />
      </div>

      <section>
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Theo Sale được giao</h2>
            <p className="text-xs text-muted-foreground">Sale nào đang ôm nhiều yêu cầu chưa xử lý, và tỷ lệ chuyển đổi thật của từng người.</p>
          </div>
        </div>
        {salerSummaries.length === 0 ? (
          <EmptyState icon={Users2} title="Chưa có yêu cầu chăm sóc lại nào trong tháng" description="Số liệu sẽ xuất hiện khi Marketing gửi yêu cầu mới." />
        ) : (
          <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="overflow-x-auto">
              <Table className="min-w-[780px]">
                <TableHeader className="bg-secondary/60">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Sale</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Được giao</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đang chờ</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đã xử lý</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Chuyển đổi thật</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">TG xử lý TB</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salerSummaries.map((s) => (
                    <TableRow key={s.saleKey} className="odd:bg-secondary/10">
                      <TableCell className="min-w-40 px-5 py-3">
                        <p className="truncate font-medium text-foreground" title={s.saleName}>{s.saleName}</p>
                      </TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-foreground">{s.stats.total}</TableCell>
                      <TableCell className={`px-4 text-center font-mono text-sm ${s.stats.pending > 0 ? "text-status-waiting" : "text-muted-foreground"}`}>
                        {s.stats.pending}
                      </TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-status-qualified">{s.stats.resolvedCount}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-foreground">{pct(s.stats.conversionRate)}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-xs text-muted-foreground">{s.stats.avgResolveLabel}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
