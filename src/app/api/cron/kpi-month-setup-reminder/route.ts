import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { currentKpiMonth } from "@/lib/interactions/settings";
import { logSystemAction } from "@/lib/interactions/audit";
import { sendEmail, appLink, emailEnvelope } from "@/lib/email";

// Vercel Cron tự gắn header "Authorization: Bearer $CRON_SECRET" — xem comment
// tương ứng ở /api/cron/kpi-reminders/route.ts.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// Chạy hằng ngày (xem vercel.json) — nhắc TOÀN BỘ Admin nếu chỉ tiêu KPI của
// THÁNG HIỆN TẠI chưa được cấu hình ở /admin/monitoring (configGroup "kpi",
// key "YYYY-MM", xem lib/interactions/settings.ts). Thiếu thì hệ thống vẫn
// tự chạy được (getMonthlyKpiTarget() fallback 100), nhưng Admin cần biết để
// nhập đúng số thật — cùng threadKey mỗi tháng nên các lần nhắc liên tiếp (do
// vẫn chưa nhập) gộp chung 1 hội thoại thay vì tách lẻ mỗi ngày. Ngưng tự
// động khi Admin đã nhập (không còn thấy dòng nào thiếu để nhắc nữa).
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });

  const month = currentKpiMonth();
  const setting = await prisma.appSetting.findUnique({ where: { configGroup_key: { configGroup: "kpi", key: month } } });

  if (setting) {
    return Response.json({ month, alreadyConfigured: true, sent: 0 });
  }

  const admins = await prisma.user.findMany({ where: { role: ROLES.ADMIN, active: true }, select: { email: true, fullName: true } });
  if (admins.length === 0) {
    await logSystemAction(prisma, SYSTEM_LOG_ACTION.KPI_MONTH_SETUP_REMINDER, { month, admins: 0 }, "FAIL", "Không có Admin nào đang hoạt động để gửi.");
    return Response.json({ month, alreadyConfigured: false, sent: 0 });
  }

  const link = appLink("/admin/monitoring");
  const [first, ...rest] = admins;
  await sendEmail({
    to: first.email,
    toName: first.fullName,
    bcc: rest.map((a) => a.email),
    subject: `Chưa cấu hình chỉ tiêu KPI tháng ${month}`,
    html: emailEnvelope({
      audienceNote: `Gửi tới toàn bộ Admin đang hoạt động (${admins.length} người).`,
      purpose: `Tháng ${month} chưa được cấu hình chỉ tiêu chốt học viên — hệ thống đang tạm tính theo mặc định cho tới khi có người nhập.`,
      bodyHtml: `<p><strong>Việc cần làm:</strong> vào <strong>Trung tâm quản trị → Cấu hình hệ thống</strong> để nhập chỉ tiêu KPI cho tháng ${month}.</p>${link ? `<p><a href="${link}">Mở Trung tâm quản trị</a></p>` : ""}`,
      senderLabel: "Hệ thống tự động",
    }),
    action: SYSTEM_LOG_ACTION.KPI_MONTH_SETUP_REMINDER,
    sentByEmail: null,
    threadKey: `kpi-month-setup-reminder:${month}`,
  });

  await logSystemAction(prisma, SYSTEM_LOG_ACTION.KPI_MONTH_SETUP_REMINDER, { month, admins: admins.length });

  return Response.json({ month, alreadyConfigured: false, sent: admins.length });
}
