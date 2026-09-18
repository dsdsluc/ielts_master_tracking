import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLES, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { getSaleAllocationSuggestions, ALLOCATION_TARGET_MIN, ALLOCATION_TARGET_MAX } from "@/lib/interactions/allocation-suggestions";
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

/** Nhắc Leader/Admin khi có Sale lệch khỏi khoảng tỷ lệ chốt mục tiêu
 * (50–60%) — "increase" (chốt tốt hơn kỳ vọng, nên giao thêm khách) hoặc
 * "support" (đang gặp khó, cần hỗ trợ trước khi giao thêm). Mirror
 * sla-breach-digest: chỉ gửi khi có gì đáng báo, chạy hằng ngày (vercel.json). */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });

  const suggestions = await getSaleAllocationSuggestions();
  const increase = suggestions.filter((s) => s.kind === "increase");
  const support = suggestions.filter((s) => s.kind === "support");

  if (increase.length === 0 && support.length === 0) {
    await logSystemAction(prisma, SYSTEM_LOG_ACTION.ALLOCATION_SUGGESTION_DIGEST, { increase: 0, support: 0 }, "SUCCESS", "Mọi Sale đang trong khoảng tỷ lệ chốt mục tiêu.");
    return Response.json({ sent: false, increase: 0, support: 0 });
  }

  const recipients = await prisma.user.findMany({
    where: { role: { in: [ROLES.LEADER, ROLES.ADMIN] }, active: true },
    select: { email: true, fullName: true },
  });
  if (recipients.length === 0) {
    await logSystemAction(
      prisma,
      SYSTEM_LOG_ACTION.ALLOCATION_SUGGESTION_DIGEST,
      { increase: increase.length, support: support.length, recipients: 0 },
      "FAIL",
      "Không có Leader/Admin nào đang hoạt động để gửi."
    );
    return Response.json({ sent: false, increase: increase.length, support: support.length, recipients: 0 });
  }

  const link = appLink("/leader-dashboard");
  const increaseHtml = increase.length
    ? `<p><strong>${increase.length} Sale nên giao thêm khách</strong> (tỷ lệ chốt trên ${ALLOCATION_TARGET_MAX}%):</p><ul>${increase
        .map((s) => `<li>${escapeHtml(s.fullName)} — ${s.enrolled}/${s.totalAssigned} khách (${s.closeRate.toFixed(1)}%), gợi ý thêm ~${s.suggestedAdditional}</li>`)
        .join("")}</ul>`
    : "";
  const supportHtml = support.length
    ? `<p><strong>${support.length} Sale cần hỗ trợ</strong> (tỷ lệ chốt dưới ${ALLOCATION_TARGET_MIN}%, tạm chưa nên giao thêm):</p><ul>${support
        .map((s) => `<li>${escapeHtml(s.fullName)} — ${s.enrolled}/${s.totalAssigned} khách (${s.closeRate.toFixed(1)}%)</li>`)
        .join("")}</ul>`
    : "";

  const [first, ...rest] = recipients;
  await sendEmail({
    to: first.email,
    toName: first.fullName,
    bcc: rest.map((r) => r.email),
    subject: `Gợi ý phân bổ khách hàng: ${increase.length} nên tăng, ${support.length} cần hỗ trợ`,
    html: emailEnvelope({
      audienceNote: `Gửi tới toàn bộ Leader/Admin đang hoạt động (${recipients.length} người).`,
      purpose: "Có Sale đang lệch khỏi khoảng tỷ lệ chốt mục tiêu — hệ thống tự động rà soát hằng ngày.",
      bodyHtml: `${increaseHtml}${supportHtml}<p><strong>Việc cần làm:</strong> ${link ? `<a href="${link}">xem chi tiết ở Dashboard Leader</a> rồi` : ""} cân đối lại phân bổ cho các Sale nêu trên.</p>`,
      senderLabel: "Hệ thống tự động",
    }),
    action: SYSTEM_LOG_ACTION.ALLOCATION_SUGGESTION_DIGEST,
    sentByEmail: null,
    threadKey: "allocation-suggestion-digest",
  });

  await logSystemAction(prisma, SYSTEM_LOG_ACTION.ALLOCATION_SUGGESTION_DIGEST, { increase: increase.length, support: support.length, recipients: recipients.length });

  return Response.json({ sent: true, increase: increase.length, support: support.length, recipients: recipients.length });
}
