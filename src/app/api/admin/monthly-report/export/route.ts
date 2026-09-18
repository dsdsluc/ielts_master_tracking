import { Workbook, type Worksheet } from "exceljs";
import { requireApiUser } from "@/lib/auth/api";
import { canAccessFeature } from "@/lib/auth/feature-access";
import { Errors, errorResponse } from "@/lib/interactions/errors";
import { monthLabel } from "@/app/(app)/admin/monthly-report/month-utils";
import { getMonthlyReport, type MonthlyReport, type NamedCount } from "@/lib/admin/monthly-report";

const MONTH_RE = /^\d{4}-\d{2}$/;
const MAX_MONTHS = 4;

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function addOverviewSheet(workbook: Workbook, reports: MonthlyReport[]) {
  const sheet = workbook.addWorksheet("Tổng quan");
  sheet.columns = [
    { header: "Chỉ số", key: "metric", width: 34 },
    ...reports.map((r) => ({ header: monthLabel(r.month), key: r.month, width: 18 })),
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEDE7" } };
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];

  type Row = { metric: string; get: (r: MonthlyReport) => string | number };
  const rows: Row[] = [
    { metric: "Tổng liên hệ", get: (r) => r.leadFunnel.total },
    { metric: "Chờ", get: (r) => r.leadFunnel.waiting },
    { metric: "Có nhu cầu", get: (r) => r.leadFunnel.processing },
    { metric: "Đủ tiêu chuẩn", get: (r) => r.leadFunnel.qualified },
    { metric: "Spam", get: (r) => r.leadFunnel.spam },
    { metric: "Tỷ lệ đủ tiêu chuẩn", get: (r) => pct(r.leadFunnel.qualifiedRate) },
    { metric: "Tỷ lệ Spam", get: (r) => pct(r.leadFunnel.spamRate) },
    { metric: "Tồn đọng (Chờ + Có nhu cầu)", get: (r) => r.leadFunnel.unresolved },
    { metric: "Khách được phân bổ", get: (r) => r.customerFunnel.assignedThisMonth },
    { metric: "Đã chốt trong tháng", get: (r) => r.customerFunnel.enrolledThisMonth },
    { metric: "Chỉ tiêu công ty", get: (r) => r.customerFunnel.companyTarget },
    { metric: "Tiến độ chỉ tiêu", get: (r) => pct(r.customerFunnel.targetProgress) },
    { metric: "Không quan tâm", get: (r) => r.customerFunnel.notInterestedCount },
    { metric: "Tổng chi phí quảng cáo (VND)", get: (r) => r.marketing.totalAdSpend },
    { metric: "Liên hệ có Ad ID", get: (r) => r.marketing.totalLeadsWithAd },
    { metric: "CP / liên hệ (VND)", get: (r) => (r.marketing.costPerLead != null ? Math.round(r.marketing.costPerLead) : "") },
    { metric: "Chăm sóc lại — đã gửi", get: (r) => r.followup.total },
    { metric: "Chăm sóc lại — đã xử lý", get: (r) => r.followup.resolvedCount },
    { metric: "Chăm sóc lại — chuyển đổi thật", get: (r) => pct(r.followup.conversionRate) },
  ];

  for (const row of rows) {
    const data: Record<string, string | number> = { metric: row.metric };
    for (const r of reports) data[r.month] = row.get(r);
    sheet.addRow(data);
  }
}

function addNamedCountTable(sheet: Worksheet, title: string, rows: NamedCount[]) {
  const titleRow = sheet.addRow([title]);
  titleRow.font = { bold: true };
  sheet.addRow(["Tên", "Tổng", "Đủ tiêu chuẩn", "Tỷ lệ"]).font = { bold: true };
  for (const r of rows) {
    sheet.addRow([r.label, r.total, r.qualified, r.total > 0 ? pct((r.qualified / r.total) * 100) : ""]);
  }
  sheet.addRow([]);
}

function addMonthDetailSheet(workbook: Workbook, report: MonthlyReport) {
  const sheet = workbook.addWorksheet(monthLabel(report.month).slice(0, 31));
  sheet.columns = [{ width: 26 }, { width: 14 }, { width: 14 }, { width: 12 }];

  addNamedCountTable(sheet, "Liên hệ theo Nguồn", report.bySource);
  addNamedCountTable(sheet, "Liên hệ theo Cơ sở", report.byBranch);
  addNamedCountTable(sheet, "Top Page theo lượng liên hệ", report.marketing.topFanpages);

  const stageTitle = sheet.addRow(["Phân bố theo mốc tư vấn"]);
  stageTitle.font = { bold: true };
  sheet.addRow(["Mốc", "Số lượng", "Tỷ lệ"]).font = { bold: true };
  for (const s of report.customerFunnel.stageBreakdown) {
    sheet.addRow([
      s.label,
      s.count,
      report.customerFunnel.assignedThisMonth > 0 ? pct((s.count / report.customerFunnel.assignedThisMonth) * 100) : "",
    ]);
  }
  sheet.addRow([]);

  const saleTitle = sheet.addRow(["Hiệu suất Sale"]);
  saleTitle.font = { bold: true };
  sheet.addRow(["Sale", "Email", "Tạo mới", "Đủ tiêu chuẩn", "Tỷ lệ"]).font = { bold: true };
  for (const s of report.salePerformance) {
    sheet.addRow([s.fullName, s.email, s.created, s.qualified, pct(s.qualifiedRate)]);
  }
}

export async function GET(request: Request) {
  try {
    const actor = await requireApiUser();
    if (!(await canAccessFeature(actor, "monthlyReport"))) {
      throw Errors.forbidden("Bạn không có quyền xuất báo cáo tháng.");
    }

    const url = new URL(request.url);
    const monthParam = url.searchParams.get("month") ?? "";
    const compareParam = url.searchParams.get("compare") ?? "";
    if (!MONTH_RE.test(monthParam)) throw Errors.forbidden("Tháng không hợp lệ.");

    const compareMonths = [
      ...new Set(
        compareParam
          .split(",")
          .map((m) => m.trim())
          .filter((m) => MONTH_RE.test(m) && m !== monthParam)
      ),
    ]
      .slice(0, MAX_MONTHS - 1)
      .sort();

    const reports = await Promise.all([monthParam, ...compareMonths].map(getMonthlyReport));

    const workbook = new Workbook();
    workbook.creator = "Theo dõi Liên hệ · IELTS Master";
    workbook.created = new Date();

    addOverviewSheet(workbook, reports);
    for (const report of reports) addMonthDetailSheet(workbook, report);

    const buffer = await workbook.xlsx.writeBuffer();
    const suffix = reports.map((r) => r.month).join("_vs_");
    const filename = `bao-cao-thang-${suffix}.xlsx`;

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
