import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SALE_LIKE_ROLES, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { computeSalePersonalKpi } from "@/lib/customers/stats";
import { logSystemAction } from "@/lib/interactions/audit";
import { sendEmail, appLink, emailEnvelope } from "@/lib/email";

// Vercel Cron tự gắn header "Authorization: Bearer $CRON_SECRET" cho request
// nó gọi, MIỄN LÀ biến môi trường CRON_SECRET đã cấu hình trên project — nếu
// dùng scheduler khác (cron-job.org, GitHub Actions...) phải tự set header
// này. Thiếu CRON_SECRET thì luôn từ chối (không có nghĩa "mở cho tất cả").
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// Nhắc từng Sale còn thiếu chỉ tiêu THÁNG (chưa đạt monthly.target) — chạy
// hằng ngày (xem vercel.json). Chỉ nhắc người ĐÃ được phân bổ khách hàng
// (mineAssigned > 0), vì chưa được giao gì thì chưa có gì để nhắc. Không giới
// hạn "chỉ nhắc khi lệch nhịp" để giữ đơn giản ở bản đầu tiên — có thể tinh
// chỉnh ngưỡng/tần suất sau khi thấy phản hồi thực tế.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });

  const sales = await prisma.user.findMany({ where: { role: { in: SALE_LIKE_ROLES }, active: true }, select: { email: true, fullName: true } });

  let sent = 0;
  for (const sale of sales) {
    const kpi = await computeSalePersonalKpi(sale.email);
    if (kpi.mineAssigned === 0 || kpi.monthly.achieved >= kpi.monthly.target) continue;

    const remaining = kpi.monthly.target - kpi.monthly.achieved;
    const link = appLink("/workspace");
    await sendEmail({
      to: sale.email,
      toName: sale.fullName,
      subject: `Nhắc chỉ tiêu tháng ${kpi.month}: còn thiếu ${remaining}`,
      html: emailEnvelope({
        greetingName: sale.fullName,
        purpose: `Bạn chưa đạt chỉ tiêu chốt học viên tháng ${kpi.month} — hệ thống tự động nhắc hằng ngày tới khi đạt đủ.`,
        bodyHtml: `<p>Chỉ tiêu tháng ${kpi.month} của bạn là <strong>${kpi.monthly.target}</strong> khách chốt — hiện đã chốt <strong>${kpi.monthly.achieved}</strong>, còn thiếu <strong>${remaining}</strong>.</p><p><strong>Việc cần làm:</strong> hôm nay cần chốt thêm <strong>${kpi.daily.target}</strong>, tuần này cần chốt thêm <strong>${kpi.weekly.target}</strong>.</p>${link ? `<p><a href="${link}">Xem Workspace của tôi</a></p>` : ""}`,
        senderLabel: "Hệ thống tự động",
      }),
      action: SYSTEM_LOG_ACTION.KPI_REMINDER,
      sentByEmail: null,
      threadKey: `kpi-reminder:${sale.email}:${kpi.month}`,
    });
    sent++;
  }

  await logSystemAction(prisma, SYSTEM_LOG_ACTION.KPI_REMINDER, { checked: sales.length, sent });

  return Response.json({ checked: sales.length, sent });
}
