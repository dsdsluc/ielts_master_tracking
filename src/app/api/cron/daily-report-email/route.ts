import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, SALE_LIKE_ROLES, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { computeDailySummary, type DailySummary } from "@/lib/customers/daily-report";
import { logSystemAction } from "@/lib/interactions/audit";
import { sendEmail, emailEnvelope } from "@/lib/email";
import { escapeHtml } from "@/lib/html-escape";

// Vercel Cron tự gắn header "Authorization: Bearer $CRON_SECRET" — xem comment
// tương ứng ở /api/cron/kpi-reminders/route.ts.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function formatVnDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function summaryListHtml(s: DailySummary): string {
  return `<ul style="margin:0 0 4px;padding-left:20px;color:#222;font-size:14px;line-height:1.7;">
<li>Số lượng khách mới nhận: <strong>${s.newLeadsToday}</strong></li>
<li>Số lượng khách cũ đã liên hệ: <strong>${s.oldCustomersContactedToday}</strong></li>
<li>Khách hẹn test: <strong>${s.testScheduledToday}</strong></li>
<li>Khách đã tư vấn: <strong>${s.consultedToday}</strong></li>
<li>Khách dự kiến đăng ký: <strong>${s.enrolledToday}</strong></li>
</ul>`;
}

// Chạy hằng ngày lúc 19h (7h tối) giờ VN — chốt số liệu gần cuối ngày làm
// việc. CHỈ chạy qua crontab hệ thống trên VPS (không đăng ký ở vercel.json,
// cố tình — cron này không cần chạy trên Vercel), gửi 1 email "Báo cáo
// nhanh" duy nhất cho TOÀN BỘ Admin, gồm 2 phần: (1) số liệu gộp TOÀN HỆ
// THỐNG, (2) số liệu riêng của TỪNG Sale — Leader trong tổ chức này cũng tự
// tay tư vấn khách nên được tính chung vào phần (2) như 1 Sale bình thường
// (xem SALE_LIKE_ROLES ở lib/interactions/constants.ts). Cùng công thức với
// /daily-report (computeDailySummary) nên số liệu luôn khớp giữa email và
// trang xem trực tiếp.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });

  const [admins, sales, companySummary] = await Promise.all([
    prisma.user.findMany({ where: { role: ROLES.ADMIN, active: true }, select: { email: true, fullName: true } }),
    prisma.user.findMany({ where: { role: { in: SALE_LIKE_ROLES }, active: true }, select: { email: true, fullName: true }, orderBy: { fullName: "asc" } }),
    computeDailySummary(),
  ]);

  if (admins.length === 0) {
    await logSystemAction(prisma, SYSTEM_LOG_ACTION.DAILY_REPORT_EMAIL, { admins: 0 }, "FAIL", "Không có Admin nào đang hoạt động để gửi.");
    return Response.json({ sent: 0 });
  }

  const today = new Date();
  const dateLabel = formatVnDate(today);

  const saleSummaries = await Promise.all(sales.map(async (s) => ({ ...s, summary: await computeDailySummary(s.email) })));

  let sectionIndex = 1;
  const companySectionHtml = `<p style="color:#fb8c00;font-weight:700;font-size:15px;margin:18px 0 6px;">${sectionIndex}. IELTS MASTER - BÁO CÁO CHI NHÁNH</p>${summaryListHtml(companySummary)}`;
  sectionIndex++;

  const saleSectionsHtml = saleSummaries
    .map((s) => {
      const html = `<p style="color:#fb8c00;font-weight:700;font-size:15px;margin:18px 0 6px;">${sectionIndex}. Báo cáo cá nhân – Sale ${escapeHtml(s.fullName)}</p>${summaryListHtml(s.summary)}`;
      sectionIndex++;
      return html;
    })
    .join("");

  const reportHtml = `<p style="color:#e53935;font-weight:700;font-size:17px;margin:0 0 4px;">QUICKLY REPORT – NGÀY ${dateLabel}</p>${companySectionHtml}${saleSectionsHtml}`;

  const [first, ...rest] = admins;
  await sendEmail({
    to: first.email,
    toName: first.fullName,
    bcc: rest.map((a) => a.email),
    subject: `Quickly Report – Ngày ${dateLabel}`,
    html: emailEnvelope({
      audienceNote: `Gửi tới toàn bộ Admin đang hoạt động (${admins.length} người).`,
      purpose: `Báo cáo nhanh hoạt động hôm nay — toàn hệ thống và từng Sale (bao gồm cả Leader) — hệ thống tự động gửi 7h sáng hằng ngày.`,
      bodyHtml: reportHtml,
      senderLabel: "Hệ thống tự động",
    }),
    action: SYSTEM_LOG_ACTION.DAILY_REPORT_EMAIL,
    sentByEmail: null,
    threadKey: "daily-report-email",
  });

  await logSystemAction(prisma, SYSTEM_LOG_ACTION.DAILY_REPORT_EMAIL, { admins: admins.length, sales: sales.length });

  return Response.json({ admins: admins.length, sales: sales.length, sent: 1 });
}
