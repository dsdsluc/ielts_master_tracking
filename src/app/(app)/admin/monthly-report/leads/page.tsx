import { Building2, CalendarDays, Radio } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { currentKpiMonth } from "@/lib/interactions/settings";
import { getLeadFunnelDetail, type StatusBreakdownRow } from "@/lib/admin/monthly-report";
import { monthLabel } from "@/app/(app)/admin/monthly-report/month-utils";
import { DetailMonthNav } from "@/app/(app)/admin/monthly-report/detail-month-nav";

const MONTH_RE = /^\d{4}-\d{2}$/;

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function StatusBreakdownTable({ title, rows, emptyText }: { title: string; rows: StatusBreakdownRow[]; emptyText: string }) {
  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="border-b border-border/70 px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[560px]">
            <TableHeader className="bg-secondary/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tên</TableHead>
                <TableHead className="px-3 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Chờ</TableHead>
                <TableHead className="px-3 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Có nhu cầu</TableHead>
                <TableHead className="px-3 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đủ ĐK</TableHead>
                <TableHead className="px-3 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Spam</TableHead>
                <TableHead className="px-3 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tổng</TableHead>
                <TableHead className="px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tỷ lệ ĐK</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key} className="odd:bg-secondary/10">
                  <TableCell className="max-w-40 truncate px-4 py-2.5 text-sm font-medium text-foreground" title={r.label}>
                    {r.label}
                  </TableCell>
                  <TableCell className="px-3 text-center font-mono text-sm text-status-waiting">{r.waiting}</TableCell>
                  <TableCell className="px-3 text-center font-mono text-sm text-status-received">{r.processing}</TableCell>
                  <TableCell className="px-3 text-center font-mono text-sm text-status-qualified">{r.qualified}</TableCell>
                  <TableCell className="px-3 text-center font-mono text-sm text-status-spam">{r.spam}</TableCell>
                  <TableCell className="px-3 text-center font-mono text-sm font-medium text-foreground">{r.total}</TableCell>
                  <TableCell className="px-3 font-mono text-xs text-muted-foreground">{r.total > 0 ? pct((r.qualified / r.total) * 100) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default async function LeadFunnelDetailPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "monthlyReport");

  const { month: monthParam } = await searchParams;
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : currentKpiMonth();

  const { bySource, byBranch, daily } = await getLeadFunnelDetail(month);
  const maxDaily = Math.max(1, ...daily.map((d) => d.total));

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Chi tiết phễu liên hệ"
        description={`${monthLabel(month)} — liên hệ theo Nguồn/Cơ sở tách rõ từng trạng thái, và xu hướng theo từng ngày trong tháng.`}
        action={<DetailMonthNav month={month} basePath="/admin/monthly-report/leads" />}
      />

      <div className="mb-10 flex flex-col gap-4 lg:flex-row">
        <div className="flex-1">
          <div className="mb-3 flex items-center gap-2">
            <Radio className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Theo Nguồn</h2>
          </div>
          <StatusBreakdownTable title="Nguồn" rows={bySource} emptyText="Chưa có liên hệ nào trong tháng." />
        </div>
        <div className="flex-1">
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Theo Cơ sở</h2>
          </div>
          <StatusBreakdownTable title="Cơ sở" rows={byBranch} emptyText="Chưa có liên hệ nào trong tháng." />
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarDays className="size-4" />
          </span>
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Xu hướng theo ngày</h2>
            <p className="text-xs text-muted-foreground">Số liên hệ tạo mới mỗi ngày trong tháng — dễ nhận ra ngày/đợt phát sinh bất thường.</p>
          </div>
        </div>
        {daily.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Chưa có liên hệ nào trong tháng" description="Xu hướng theo ngày sẽ xuất hiện khi có liên hệ mới." />
        ) : (
          <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex flex-col gap-2">
              {daily.map((d) => (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{formatDay(d.date)}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${(d.total / maxDaily) * 100}%` }} />
                  </div>
                  <span className="w-20 shrink-0 text-right font-mono text-xs text-foreground">
                    {d.total} <span className="text-status-qualified">({d.qualified})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
