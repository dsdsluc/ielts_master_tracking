import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { ROLES } from "@/lib/interactions/constants";
import { getPageReportRows } from "@/lib/marketing/page-report";
import { PageReportDatePicker } from "@/app/(app)/page-report/page-report-date-picker";
import { PageReportTable } from "@/app/(app)/page-report/page-report-table";
import { CalendarCheck, ClipboardCheck } from "lucide-react";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function PageReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireRole(ROLES.MARKETING, ROLES.ADMIN);
  const { date: dateParam } = await searchParams;
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayStr();

  const rows = await getPageReportRows(date);
  const canClose = user.role === ROLES.ADMIN || user.canCloseMktReport;

  const totalLeads = rows.reduce((sum, r) => sum + r.totalLeads, 0);
  const totalQualified = rows.reduce((sum, r) => sum + r.qualifiedLeads, 0);
  const overallRate = totalLeads > 0 ? (totalQualified / totalLeads) * 100 : 0;
  const closedCount = rows.filter((r) => r.closed).length;

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Báo cáo Page hằng ngày"
        description="Tin nhắn nhận được và tỷ lệ xin SĐT theo từng Page, tính theo ngày TẠO lead. Chốt để giữ nguyên số liệu."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {user.role === ROLES.ADMIN && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-full"
                nativeButton={false}
                render={<Link href="/page-report/closed" />}
              >
                <ClipboardCheck className="size-3.5" />
                Tổng quan đã chốt
              </Button>
            )}
            <PageReportDatePicker date={date} />
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Tổng tin nhắn" value={totalLeads} accentClassName="bg-foreground/50" />
        <KpiCard label="Tổng khách xin SĐT" value={totalQualified} accentClassName="bg-status-qualified" />
        <KpiCard label="Tỷ lệ chuyển đổi" value={`${overallRate.toFixed(1)}%`} accentClassName="bg-primary" />
        <KpiCard label="Page đã chốt" value={`${closedCount}/${rows.length}`} accentClassName="bg-status-received" />
      </div>

      {!canClose && (
        <p className="mb-4 text-xs text-muted-foreground">
          Bạn chỉ có thể xem — chưa được cấp quyền chốt báo cáo (liên hệ Quản trị hệ thống ở trang Người dùng nếu cần).
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="Chưa có Page nào" description="Thêm Page đang hoạt động ở trang Fanpage để bắt đầu theo dõi." />
      ) : (
        <PageReportTable rows={rows} date={date} canClose={canClose} isAdmin={user.role === ROLES.ADMIN} />
      )}
    </>
  );
}
