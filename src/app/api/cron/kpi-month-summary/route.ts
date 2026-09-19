import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { computeTeamPersonalKpi } from "@/lib/customers/stats";
import { logSystemAction } from "@/lib/interactions/audit";
import { sendEmail, appLink, emailEnvelope } from "@/lib/email";
import { escapeHtml } from "@/lib/html-escape";

// Vercel Cron tự gắn header "Authorization: Bearer $CRON_SECRET" — xem comment
// tương ứng ở /api/cron/kpi-reminders/route.ts.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function previousMonthKey(today: Date): string {
  const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

// Chạy hằng ngày (xem vercel.json) nhưng CHỈ THỰC SỰ gửi vào ngày 1 hằng
// tháng — tính lại KPI của THÁNG VỪA KẾT THÚC (không phải ngày cuối tháng,
// vì lúc đó vẫn còn vài giờ trong ngày chưa trôi qua, số liệu dễ thiếu) rồi
// gửi 1 email tổng kết cho TOÀN BỘ tài khoản đang hoạt động — mirror
// /api/cron/sla-breach-digest (1 người nhận chính + BCC phần còn lại).
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });

  const today = new Date();
  if (today.getDate() !== 1) {
    return Response.json({ skipped: true, reason: "Chỉ gửi vào ngày 1 hằng tháng." });
  }

  const month = previousMonthKey(today);
  const summary = await computeTeamPersonalKpi(month);
  const totalEnrolled = summary.rows.reduce((sum, r) => sum + r.enrolled, 0);
  const companyMet = totalEnrolled >= summary.companyTarget;

  const recipients = await prisma.user.findMany({ where: { active: true }, select: { email: true, fullName: true } });
  if (recipients.length === 0) {
    await logSystemAction(prisma, SYSTEM_LOG_ACTION.KPI_MONTH_SUMMARY, { month, recipients: 0 }, "FAIL", "Không có tài khoản nào đang hoạt động để gửi.");
    return Response.json({ month, sent: 0 });
  }

  const rowsHtml = summary.rows
    .sort((a, b) => b.enrolled - a.enrolled)
    .map(
      (r) =>
        `<tr><td style="padding:4px 10px;border-bottom:1px solid #eee;">${escapeHtml(r.fullName)}</td><td style="padding:4px 10px;border-bottom:1px solid #eee;text-align:center;">${r.personalTarget}</td><td style="padding:4px 10px;border-bottom:1px solid #eee;text-align:center;">${r.enrolled}</td><td style="padding:4px 10px;border-bottom:1px solid #eee;text-align:center;">${r.met ? "Đạt" : "Chưa đạt"}</td></tr>`
    )
    .join("");
  const tableHtml =
    summary.rows.length > 0
      ? `<table style="border-collapse:collapse;width:100%;max-width:520px;font-size:13px;"><thead><tr><th style="text-align:left;padding:4px 10px;border-bottom:2px solid #ddd;">Sale</th><th style="padding:4px 10px;border-bottom:2px solid #ddd;">Chỉ tiêu</th><th style="padding:4px 10px;border-bottom:2px solid #ddd;">Đã chốt</th><th style="padding:4px 10px;border-bottom:2px solid #ddd;">Kết quả</th></tr></thead><tbody>${rowsHtml}</tbody></table>`
      : "<p>Chưa có Sale nào được giao khách hàng trong tháng này.</p>";

  const link = appLink("/admin/monitoring");
  const [first, ...rest] = recipients;
  await sendEmail({
    to: first.email,
    toName: first.fullName,
    bcc: rest.map((r) => r.email),
    subject: `Kết quả KPI tháng ${month}: ${totalEnrolled}/${summary.companyTarget} học viên`,
    html: emailEnvelope({
      audienceNote: `Gửi tới toàn bộ tài khoản đang hoạt động (${recipients.length} người).`,
      purpose: `Tổng kết chỉ tiêu chốt học viên tháng ${month} — toàn công ty ${companyMet ? "đã đạt" : "chưa đạt"} chỉ tiêu (${totalEnrolled}/${summary.companyTarget}).`,
      bodyHtml: `<p>Chi tiết theo từng Sale:</p>${tableHtml}${link ? `<p style="margin-top:14px;"><a href="${link}">Xem báo cáo tháng đầy đủ</a></p>` : ""}`,
      senderLabel: "Hệ thống tự động",
    }),
    action: SYSTEM_LOG_ACTION.KPI_MONTH_SUMMARY,
    sentByEmail: null,
    threadKey: `kpi-month-summary:${month}`,
  });

  await logSystemAction(prisma, SYSTEM_LOG_ACTION.KPI_MONTH_SUMMARY, { month, companyTarget: summary.companyTarget, totalEnrolled, recipients: recipients.length });

  return Response.json({ month, companyTarget: summary.companyTarget, totalEnrolled, sent: recipients.length });
}
