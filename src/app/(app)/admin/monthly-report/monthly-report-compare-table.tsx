import { GitCompareArrows } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd } from "@/app/(app)/ads-cost/format";
import { monthLabel } from "@/app/(app)/admin/monthly-report/month-utils";
import type { MonthlyReport } from "@/lib/admin/monthly-report";

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

type MetricGroup = { group: string; rows: { label: string; value: (r: MonthlyReport) => string }[] };

const METRIC_GROUPS: MetricGroup[] = [
  {
    group: "Phễu liên hệ",
    rows: [
      { label: "Tổng liên hệ", value: (r) => String(r.leadFunnel.total) },
      { label: "Chờ", value: (r) => String(r.leadFunnel.waiting) },
      { label: "Có nhu cầu", value: (r) => String(r.leadFunnel.processing) },
      { label: "Đủ tiêu chuẩn", value: (r) => String(r.leadFunnel.qualified) },
      { label: "Spam", value: (r) => String(r.leadFunnel.spam) },
      { label: "Tỷ lệ đủ tiêu chuẩn", value: (r) => pct(r.leadFunnel.qualifiedRate) },
      { label: "Tỷ lệ Spam", value: (r) => pct(r.leadFunnel.spamRate) },
      { label: "Tồn đọng (Chờ + Có nhu cầu)", value: (r) => String(r.leadFunnel.unresolved) },
    ],
  },
  {
    group: "Tư vấn ghi danh",
    rows: [
      { label: "Khách được phân bổ", value: (r) => String(r.customerFunnel.assignedThisMonth) },
      { label: "Đã chốt trong tháng", value: (r) => String(r.customerFunnel.enrolledThisMonth) },
      { label: "Chỉ tiêu công ty", value: (r) => String(r.customerFunnel.companyTarget) },
      { label: "Tiến độ chỉ tiêu", value: (r) => pct(r.customerFunnel.targetProgress) },
      { label: "Không quan tâm", value: (r) => String(r.customerFunnel.notInterestedCount) },
    ],
  },
  {
    group: "Marketing",
    rows: [
      { label: "Tổng chi phí quảng cáo", value: (r) => formatVnd(r.marketing.totalAdSpend) },
      { label: "Liên hệ có Ad ID", value: (r) => String(r.marketing.totalLeadsWithAd) },
      { label: "CP / liên hệ", value: (r) => (r.marketing.costPerLead != null ? formatVnd(Math.round(r.marketing.costPerLead)) : "—") },
    ],
  },
  {
    group: "Chăm sóc lại",
    rows: [
      { label: "Đã gửi yêu cầu", value: (r) => String(r.followup.total) },
      { label: "Đã xử lý", value: (r) => String(r.followup.resolvedCount) },
      { label: "Chuyển đổi thật", value: (r) => pct(r.followup.conversionRate) },
    ],
  },
];

/** So sánh nhiều tháng cạnh nhau — mỗi cột là 1 tháng, mỗi dòng là 1 chỉ số,
 * đúng bố cục quen thuộc của báo cáo tài chính/kinh doanh theo kỳ, dễ quét
 * mắt hơn nhiều so với xếp từng tháng thành khối riêng lặp lại. */
export function MonthlyReportCompareTable({ reports, highlightFirst = true }: { reports: MonthlyReport[]; highlightFirst?: boolean }) {
  return (
    <section>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <GitCompareArrows className="size-4" />
        </span>
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">So sánh giữa các tháng</h2>
          <p className="text-xs text-muted-foreground">
            {highlightFirst ? "Cột đầu tiên là tháng đang xem, các cột sau là những tháng được chọn để so sánh." : "Mỗi cột là 1 tháng, ngang hàng nhau."}
          </p>
        </div>
      </div>
      <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-52 px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Chỉ số</TableHead>
                {reports.map((r, i) => (
                  <TableHead
                    key={r.month}
                    className={`px-4 text-center font-condensed text-[10px] tracking-wider uppercase ${highlightFirst && i === 0 ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {monthLabel(r.month)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {METRIC_GROUPS.flatMap((g) => [
                <TableRow key={`group-${g.group}`} className="bg-secondary/40 hover:bg-secondary/40">
                  <TableCell colSpan={reports.length + 1} className="px-5 py-1.5 font-condensed text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                    {g.group}
                  </TableCell>
                </TableRow>,
                ...g.rows.map((row) => (
                  <TableRow key={row.label} className="odd:bg-secondary/10">
                    <TableCell className="px-5 py-2.5 text-sm text-foreground">{row.label}</TableCell>
                    {reports.map((r, i) => (
                      <TableCell key={r.month} className={`px-4 text-center font-mono text-sm ${highlightFirst && i === 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {row.value(r)}
                      </TableCell>
                    ))}
                  </TableRow>
                )),
              ])}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
