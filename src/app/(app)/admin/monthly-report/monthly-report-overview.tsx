import Link from "next/link";
import { AlertTriangle, BadgeCheck, ChevronRight, GraduationCap, Megaphone, PhoneCall, Sparkles, Users2 } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd } from "@/app/(app)/ads-cost/format";
import { CUSTOMER_STAGE } from "@/lib/interactions/constants";
import type { MonthlyReport, NamedCount, StageCount } from "@/lib/admin/monthly-report";

function SectionHeader({
  icon: Icon,
  title,
  description,
  detailHref,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  detailHref?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {detailHref && (
        <Link href={detailHref} className="flex shrink-0 items-center gap-1 pt-1.5 text-xs font-medium text-primary hover:underline">
          Xem chi tiết <ChevronRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function BreakdownTable({ title, rows, emptyText }: { title: string; rows: NamedCount[]; emptyText: string }) {
  return (
    <div className="shadow-bubble flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="border-b border-border/70 px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <Table>
          <TableHeader className="bg-secondary/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tên</TableHead>
              <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tổng</TableHead>
              <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đủ ĐK</TableHead>
              <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tỷ lệ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key} className="odd:bg-secondary/10">
                <TableCell className="max-w-40 truncate px-4 py-2.5 text-sm font-medium text-foreground" title={r.label}>
                  {r.label}
                </TableCell>
                <TableCell className="px-4 text-center font-mono text-sm text-foreground">{r.total}</TableCell>
                <TableCell className="px-4 text-center font-mono text-sm text-status-qualified">{r.qualified}</TableCell>
                <TableCell className="px-4 text-center font-mono text-xs text-muted-foreground">
                  {r.total > 0 ? pct((r.qualified / r.total) * 100) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function StageBar({ rows, total }: { rows: StageCount[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.stage ?? "none"} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-xs text-muted-foreground" title={r.label}>
            {r.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className={
                r.stage === CUSTOMER_STAGE.ENROLLED
                  ? "h-full rounded-full bg-status-qualified"
                  : r.stage === CUSTOMER_STAGE.NOT_INTERESTED
                    ? "h-full rounded-full bg-destructive"
                    : "h-full rounded-full bg-primary/70"
              }
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right font-mono text-xs text-foreground">
            {r.count}
            {total > 0 && <span className="text-muted-foreground"> · {pct((r.count / total) * 100)}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MonthlyReportOverview({ report }: { report: MonthlyReport }) {
  const { month, leadFunnel, bySource, byBranch, customerFunnel, salePerformance, marketing, followup } = report;
  const q = `?month=${month}`;

  return (
    <div className="flex flex-col gap-10">
      <section>
        <SectionHeader
          icon={PhoneCall}
          title="Phễu liên hệ"
          description="Toàn bộ liên hệ TẠO MỚI trong tháng, theo trạng thái hiện tại."
          detailHref={`/admin/monthly-report/leads${q}`}
        />
        <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Tổng liên hệ" value={leadFunnel.total} accentClassName="bg-foreground/50" />
          <KpiCard label="Chờ" value={leadFunnel.waiting} accentClassName="bg-status-waiting" />
          <KpiCard label="Có nhu cầu" value={leadFunnel.processing} accentClassName="bg-status-received" />
          <KpiCard label="Đủ tiêu chuẩn" value={leadFunnel.qualified} accentClassName="bg-status-qualified" />
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Spam" value={leadFunnel.spam} accentClassName="bg-status-spam" />
          <KpiCard label="Tỷ lệ đủ tiêu chuẩn" value={pct(leadFunnel.qualifiedRate)} accentClassName="bg-status-qualified" />
          <KpiCard label="Tỷ lệ Spam" value={pct(leadFunnel.spamRate)} accentClassName="bg-status-spam" />
          <KpiCard
            label="Tồn đọng (Chờ + Có nhu cầu)"
            value={leadFunnel.unresolved}
            accentClassName={leadFunnel.unresolved > 0 ? "bg-destructive" : "bg-status-qualified"}
          />
        </div>
        <div className="flex flex-col gap-4 lg:flex-row">
          <BreakdownTable title="Theo Nguồn" rows={bySource} emptyText="Chưa có liên hệ nào trong tháng." />
          <BreakdownTable title="Theo Cơ sở" rows={byBranch} emptyText="Chưa có liên hệ nào trong tháng." />
        </div>
      </section>

      <section>
        <SectionHeader
          icon={GraduationCap}
          title="Tư vấn ghi danh"
          description="Khách hàng được Leader phân bổ cho Sale trong tháng, theo mốc tư vấn HIỆN TẠI."
          detailHref={`/admin/monthly-report/sales${q}`}
        />
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Khách được phân bổ" value={customerFunnel.assignedThisMonth} accentClassName="bg-primary" />
          <KpiCard label="Đã chốt trong tháng" value={customerFunnel.enrolledThisMonth} accentClassName="bg-status-qualified" />
          <KpiCard label="Chỉ tiêu công ty" value={customerFunnel.companyTarget} accentClassName="bg-foreground/50" />
          <KpiCard
            label="Không quan tâm"
            value={customerFunnel.notInterestedCount}
            accentClassName={customerFunnel.notInterestedCount > 0 ? "bg-destructive" : "bg-status-qualified"}
          />
        </div>
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4">
          <BadgeCheck className={customerFunnel.targetProgress >= 100 ? "size-5 text-status-qualified" : "size-5 text-muted-foreground"} />
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tiến độ chỉ tiêu tháng</span>
              <span className="font-mono font-medium text-foreground">
                {customerFunnel.enrolledThisMonth}/{customerFunnel.companyTarget} ({pct(customerFunnel.targetProgress)})
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className={customerFunnel.targetProgress >= 100 ? "h-full rounded-full bg-status-qualified" : "h-full rounded-full bg-primary"}
                style={{ width: `${Math.min(100, customerFunnel.targetProgress)}%` }}
              />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Phân bố theo mốc tư vấn</h3>
          {customerFunnel.assignedThisMonth === 0 ? (
            <EmptyState icon={Users2} title="Chưa có khách hàng nào được phân bổ trong tháng" description="Phân bổ ở trang Phân bổ khách hàng." />
          ) : (
            <StageBar rows={customerFunnel.stageBreakdown} total={customerFunnel.assignedThisMonth} />
          )}
        </div>
      </section>

      <section>
        <SectionHeader
          icon={Megaphone}
          title="Marketing & quảng cáo"
          description="Chi phí ghi nhận có kỳ báo cáo trùng với tháng này, và các Page thu hút nhiều liên hệ nhất."
          detailHref={`/admin/monthly-report/marketing${q}`}
        />
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiCard label="Tổng chi phí quảng cáo" value={formatVnd(marketing.totalAdSpend)} accentClassName="bg-primary" />
          <KpiCard label="Liên hệ có Ad ID" value={marketing.totalLeadsWithAd} accentClassName="bg-foreground/50" />
          <KpiCard label="CP / liên hệ" value={marketing.costPerLead != null ? formatVnd(Math.round(marketing.costPerLead)) : "—"} accentClassName="bg-status-qualified" />
        </div>
        <BreakdownTable title="Top Page theo lượng liên hệ" rows={marketing.topFanpages} emptyText="Chưa có liên hệ nào từ Page trong tháng." />
      </section>

      <section>
        <SectionHeader
          icon={Users2}
          title="Hiệu suất Sale"
          description="Số liên hệ mỗi Sale tự tạo trong tháng và tỷ lệ xin được SĐT. Xem chi tiết để có luôn tiến độ chăm khách theo từng mốc tư vấn."
          detailHref={`/admin/monthly-report/sales${q}`}
        />
        {salePerformance.length === 0 ? (
          <EmptyState icon={Users2} title="Chưa có Sale nào tạo liên hệ trong tháng" description="Số liệu sẽ xuất hiện khi có liên hệ mới." />
        ) : (
          <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
            <Table>
              <TableHeader className="bg-secondary/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Sale</TableHead>
                  <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tạo mới</TableHead>
                  <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đủ tiêu chuẩn</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tỷ lệ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salePerformance.map((s) => (
                  <TableRow key={s.email} className="odd:bg-secondary/10">
                    <TableCell className="min-w-40 px-5 py-3">
                      <p className="truncate font-medium text-foreground" title={s.fullName}>{s.fullName}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground" title={s.email}>{s.email}</p>
                    </TableCell>
                    <TableCell className="px-4 text-center font-mono text-sm text-foreground">{s.created}</TableCell>
                    <TableCell className="px-4 text-center font-mono text-sm text-status-qualified">{s.qualified}</TableCell>
                    <TableCell className="px-4">
                      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 font-mono text-xs font-medium text-foreground">
                        {pct(s.qualifiedRate)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          icon={Sparkles}
          title="Chăm sóc lại"
          description='Yêu cầu "Cần chăm sóc lại" Marketing gửi cho Sale trong tháng.'
          detailHref={`/admin/monthly-report/followup${q}`}
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Đã gửi" value={followup.total} accentClassName="bg-foreground/50" />
          <KpiCard label="Đang chờ xử lý" value={followup.pending} accentClassName="bg-status-waiting" />
          <KpiCard label="Đã xử lý" value={followup.resolvedCount} accentClassName="bg-status-qualified" />
          <KpiCard label="Chuyển đổi thật (ra SĐT)" value={pct(followup.conversionRate)} accentClassName="bg-status-qualified" />
        </div>
        {followup.total > 0 && followup.pending > followup.total * 0.5 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="size-3.5" /> Hơn một nửa yêu cầu chăm sóc lại trong tháng vẫn đang chờ xử lý.
          </p>
        )}
      </section>
    </div>
  );
}
