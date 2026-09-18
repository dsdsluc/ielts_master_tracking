import { GraduationCap, PhoneCall, Users2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { currentKpiMonth } from "@/lib/interactions/settings";
import { getSaleActivityDetail, STAGE_COLUMNS } from "@/lib/admin/monthly-report";
import { monthLabel } from "@/app/(app)/admin/monthly-report/month-utils";
import { DetailMonthNav } from "@/app/(app)/admin/monthly-report/detail-month-nav";

const MONTH_RE = /^\d{4}-\d{2}$/;

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default async function SalesDetailPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "monthlyReport");

  const { month: monthParam } = await searchParams;
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : currentKpiMonth();

  const { leadCreation, customerStages } = await getSaleActivityDetail(month);

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Chi tiết hiệu suất Sale"
        description={`${monthLabel(month)} — hoạt động tạo liên hệ và tiến độ chăm khách hàng được phân bổ, theo từng Sale.`}
        action={<DetailMonthNav month={month} basePath="/admin/monthly-report/sales" />}
      />

      <section className="mb-10">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PhoneCall className="size-4" />
          </span>
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Tạo liên hệ theo Sale</h2>
            <p className="text-xs text-muted-foreground">Liên hệ mỗi Sale tự tạo trong tháng, theo từng trạng thái hiện tại — không chỉ gộp đủ điều kiện/không.</p>
          </div>
        </div>
        {leadCreation.length === 0 ? (
          <EmptyState icon={Users2} title="Chưa có Sale nào tạo liên hệ trong tháng" description="Số liệu sẽ xuất hiện khi có liên hệ mới." />
        ) : (
          <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader className="bg-secondary/60">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Sale</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Chờ</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Có nhu cầu</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đủ tiêu chuẩn</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Spam</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tổng</TableHead>
                    <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tỷ lệ ĐK</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadCreation.map((s) => (
                    <TableRow key={s.email} className="odd:bg-secondary/10">
                      <TableCell className="min-w-40 px-5 py-3">
                        <p className="truncate font-medium text-foreground" title={s.fullName}>{s.fullName}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground" title={s.email}>{s.email}</p>
                      </TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-status-waiting">{s.waiting}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-status-received">{s.processing}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-status-qualified">{s.qualified}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-status-spam">{s.spam}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm font-medium text-foreground">{s.total}</TableCell>
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
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <GraduationCap className="size-4" />
          </span>
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Tư vấn khách hàng theo Sale</h2>
            <p className="text-xs text-muted-foreground">
              Khách hàng Leader phân bổ trong tháng cho từng Sale, theo mốc tư vấn HIỆN TẠI — thấy ngay Sale nào đang có nhiều khách kẹt ở 1 mốc, hoặc bị từ chối nhiều.
            </p>
          </div>
        </div>
        {customerStages.length === 0 ? (
          <EmptyState icon={Users2} title="Chưa có khách hàng nào được phân bổ trong tháng" description="Phân bổ ở trang Phân bổ khách hàng." />
        ) : (
          <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader className="bg-secondary/60">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky left-0 z-10 bg-secondary/60 px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Sale</TableHead>
                    {STAGE_COLUMNS.map((label) => (
                      <TableHead key={label} className="px-3 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">
                        {label}
                      </TableHead>
                    ))}
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tổng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerStages.map((s) => (
                    <TableRow key={s.email} className="odd:bg-secondary/10">
                      <TableCell className="sticky left-0 z-10 min-w-40 bg-card px-5 py-3 odd:bg-secondary/10">
                        <p className="truncate font-medium text-foreground" title={s.fullName}>{s.fullName}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground" title={s.email}>{s.email}</p>
                      </TableCell>
                      {STAGE_COLUMNS.map((label) => {
                        const count = s.counts[label] ?? 0;
                        const isNotInterested = label === "Không quan tâm";
                        const isEnrolled = label === "Đã chốt";
                        return (
                          <TableCell
                            key={label}
                            className={`px-3 text-center font-mono text-sm ${
                              count === 0
                                ? "text-muted-foreground/40"
                                : isNotInterested
                                  ? "text-destructive"
                                  : isEnrolled
                                    ? "font-semibold text-status-qualified"
                                    : "text-foreground"
                            }`}
                          >
                            {count}
                          </TableCell>
                        );
                      })}
                      <TableCell className="px-4 text-center font-mono text-sm font-semibold text-foreground">{s.total}</TableCell>
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
