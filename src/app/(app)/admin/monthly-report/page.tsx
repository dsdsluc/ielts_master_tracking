import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { currentKpiMonth } from "@/lib/interactions/settings";
import { getMonthlyReport } from "@/lib/admin/monthly-report";
import { MonthlyReportControls } from "@/app/(app)/admin/monthly-report/monthly-report-controls";
import { MonthlyReportOverview } from "@/app/(app)/admin/monthly-report/monthly-report-overview";

const MONTH_RE = /^\d{4}-\d{2}$/;

function parseMonth(value: string | undefined): string {
  return value && MONTH_RE.test(value) ? value : currentKpiMonth();
}

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "monthlyReport");

  const { month: monthParam } = await searchParams;
  const month = parseMonth(monthParam);

  const report = await getMonthlyReport(month);

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Báo cáo tháng"
        description="Tổng quan hoạt động trong tháng — liên hệ, tư vấn ghi danh, marketing, hiệu suất Sale — để làm báo cáo hoặc xuất dữ liệu cuối tháng."
        action={<MonthlyReportControls month={month} />}
      />

      <MonthlyReportOverview report={report} />
    </>
  );
}
