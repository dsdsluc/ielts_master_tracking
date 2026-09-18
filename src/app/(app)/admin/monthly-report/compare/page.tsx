import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { currentKpiMonth } from "@/lib/interactions/settings";
import { getMonthlyReport } from "@/lib/admin/monthly-report";
import { shiftMonth } from "@/app/(app)/admin/monthly-report/month-utils";
import { CompareMonthPicker } from "@/app/(app)/admin/monthly-report/compare/compare-month-picker";
import { MonthlyReportCompareTable } from "@/app/(app)/admin/monthly-report/monthly-report-compare-table";

const MONTH_RE = /^\d{4}-\d{2}$/;
const MAX_MONTHS = 6;

export default async function MonthlyReportComparePage({ searchParams }: { searchParams: Promise<{ months?: string }> }) {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "monthlyReport");

  const { months: monthsParam } = await searchParams;
  const now = currentKpiMonth();
  const parsed = [
    ...new Set(
      (monthsParam ?? "")
        .split(",")
        .map((m) => m.trim())
        .filter((m) => MONTH_RE.test(m))
    ),
  ]
    .slice(0, MAX_MONTHS)
    .sort();
  // Mặc định: tháng này + tháng trước — vào trang lần đầu (hoặc bấm "So sánh
  // nhiều tháng" từ trang tổng quan, chỉ mang theo đúng 1 tháng) vẫn thấy
  // ngay có gì để so sánh, không phải tự tay chọn từ con số 0.
  const months =
    parsed.length >= 2 ? parsed : parsed.length === 1 ? [shiftMonth(parsed[0], -1), parsed[0]].sort() : [shiftMonth(now, -1), now];

  const reports = await Promise.all(months.map(getMonthlyReport));

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="So sánh giữa các tháng"
        description="Chọn tự do 2-6 tháng bất kỳ để đặt cạnh nhau — không tháng nào là 'gốc', tất cả ngang hàng."
        action={<CompareMonthPicker months={months} />}
      />

      <Button variant="ghost" size="sm" className="mb-6 -mt-2 rounded-full text-muted-foreground" nativeButton={false} render={<Link href="/admin/monthly-report" />}>
        <ArrowLeft className="size-3.5" /> Quay lại báo cáo tháng
      </Button>

      <MonthlyReportCompareTable reports={reports} highlightFirst={false} />
    </>
  );
}
