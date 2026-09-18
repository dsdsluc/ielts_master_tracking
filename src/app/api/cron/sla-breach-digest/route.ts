import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, STATUS, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { getBranchSlaMap } from "@/lib/interactions/queries";
import { logSystemAction } from "@/lib/interactions/audit";
import { sendEmail, appLink, emailEnvelope } from "@/lib/email";
import { escapeHtml } from "@/lib/html-escape";

// Cùng ngưỡng "sắp/đã quá SLA" với getQueue() (lib/interactions/queries.ts) —
// hằng số riêng vì bản gốc không export, xem SLA_APPROACH_RATIO ở đó.
const SLA_APPROACH_RATIO = 0.8;
const MAX_ITEMS_IN_EMAIL = 50;

// Vercel Cron tự gắn header "Authorization: Bearer $CRON_SECRET" — xem comment
// tương ứng ở /api/cron/kpi-reminders/route.ts.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// Tổng hợp TOÀN CÔNG TY (không lọc theo cơ sở — Leader/Admin vốn đã thấy hết
// mọi chi nhánh, xem lib/interactions/scope.ts) các liên hệ đang quá/sắp quá
// SLA nhận hoặc SLA xử lý, gửi 1 email digest thay vì phải tự ghé
// /admin/monitoring mỗi ngày. Chạy hằng ngày (xem vercel.json).
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });

  const [{ byCode: slaByBranch, fallback: slaFallback }, branches, openRows] = await Promise.all([
    getBranchSlaMap(),
    prisma.branch.findMany({ select: { code: true, name: true } }),
    prisma.interaction.findMany({
      where: { activeFlag: true, needsFollowup: false, statusName: { in: [STATUS.WAITING, STATUS.PROCESSING] } },
      select: { interactionId: true, customerName: true, statusName: true, assignedBranchCode: true, createdLeadAt: true },
    }),
  ]);
  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));

  const now = Date.now();
  const breaching = openRows.filter((row) => {
    const sla = slaByBranch.get(row.assignedBranchCode) ?? slaFallback;
    const elapsedMinutes = (now - row.createdLeadAt.getTime()) / 60000;
    const isReceiveBreaching = row.statusName === STATUS.WAITING && elapsedMinutes >= sla.slaReceiveMinutes * SLA_APPROACH_RATIO;
    const isProcessBreaching = row.statusName === STATUS.PROCESSING && elapsedMinutes >= sla.slaProcessHours * 60 * SLA_APPROACH_RATIO;
    return isReceiveBreaching || isProcessBreaching;
  });

  if (breaching.length === 0) {
    await logSystemAction(prisma, SYSTEM_LOG_ACTION.SLA_BREACH_DIGEST, { breachingCount: 0 }, "SUCCESS", "Không có liên hệ nào quá/sắp quá SLA.");
    return Response.json({ sent: false, breachingCount: 0 });
  }

  const recipients = await prisma.user.findMany({
    where: { role: { in: [ROLES.LEADER, ROLES.ADMIN] }, active: true },
    select: { email: true, fullName: true },
  });
  if (recipients.length === 0) {
    await logSystemAction(prisma, SYSTEM_LOG_ACTION.SLA_BREACH_DIGEST, { breachingCount: breaching.length, recipients: 0 }, "FAIL", "Không có Leader/Admin nào đang hoạt động để gửi.");
    return Response.json({ sent: false, breachingCount: breaching.length, recipients: 0 });
  }

  const shown = breaching.slice(0, MAX_ITEMS_IN_EMAIL);
  const itemsHtml = shown
    .map((row) => {
      const link = appLink(`/leads/${row.interactionId}`);
      const safeName = escapeHtml(row.customerName);
      const branchName = escapeHtml(branchNames[row.assignedBranchCode] ?? row.assignedBranchCode);
      const label = link ? `<a href="${link}">${safeName}</a>` : safeName;
      return `<li>${label} — ${branchName} (${row.statusName})</li>`;
    })
    .join("");
  const moreNote = breaching.length > MAX_ITEMS_IN_EMAIL ? `<p>... và ${breaching.length - MAX_ITEMS_IN_EMAIL} liên hệ khác.</p>` : "";

  const [first, ...rest] = recipients;
  await sendEmail({
    to: first.email,
    toName: first.fullName,
    bcc: rest.map((r) => r.email),
    subject: `Tổng hợp quá/sắp quá SLA: ${breaching.length} liên hệ`,
    html: emailEnvelope({
      audienceNote: `Gửi tới toàn bộ Leader/Admin đang hoạt động (${recipients.length} người).`,
      purpose: `Có ${breaching.length} liên hệ đang quá hoặc sắp quá SLA xử lý — hệ thống tự động tổng hợp hằng ngày.`,
      bodyHtml: `<p><strong>Việc cần làm:</strong> phân bổ/nhắc Sale xử lý các liên hệ dưới đây:</p><ul>${itemsHtml}</ul>${moreNote}`,
      senderLabel: "Hệ thống tự động",
    }),
    action: SYSTEM_LOG_ACTION.SLA_BREACH_DIGEST,
    sentByEmail: null,
    interactionIds: shown.map((r) => r.interactionId),
    threadKey: "sla-breach-digest",
  });

  await logSystemAction(prisma, SYSTEM_LOG_ACTION.SLA_BREACH_DIGEST, { breachingCount: breaching.length, recipients: recipients.length });

  return Response.json({ sent: true, breachingCount: breaching.length, recipients: recipients.length });
}
