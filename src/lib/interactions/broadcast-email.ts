import "server-only";
import { prisma } from "@/lib/prisma";
import { ROLES, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { requireRole } from "@/lib/interactions/scope";
import { logAction } from "@/lib/interactions/audit";
import { ApiError } from "@/lib/interactions/errors";
import { sendEmail } from "@/lib/email";
import type { CurrentUser } from "@/lib/auth/dal";

const MAX_RECIPIENTS = 200;

export async function sendBroadcastEmail(
  actor: CurrentUser,
  input: { subject: string; body: string; recipientEmails: string[] }
): Promise<{ sent: number }> {
  requireRole(actor, [ROLES.ADMIN]);

  const subject = input.subject.trim();
  const body = input.body.trim();
  const recipientEmails = [...new Set(input.recipientEmails)].filter(Boolean);

  if (!subject) throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng nhập tiêu đề.");
  if (!body) throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng nhập nội dung.");
  if (recipientEmails.length === 0) throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng chọn ít nhất 1 người nhận.");
  if (recipientEmails.length > MAX_RECIPIENTS) {
    throw new ApiError(422, "VALIDATION_ERROR", `Chỉ được gửi tối đa ${MAX_RECIPIENTS} người mỗi lần.`);
  }

  // Đối chiếu lại với DB — chỉ gửi cho tài khoản có thật và đang hoạt động,
  // phòng trường hợp danh sách phía client đã cũ (người vừa bị khoá tài khoản).
  const recipients = await prisma.user.findMany({
    where: { email: { in: recipientEmails }, active: true },
    select: { email: true },
  });
  const validEmails = recipients.map((r) => r.email);
  if (validEmails.length === 0) {
    throw new ApiError(422, "VALIDATION_ERROR", "Không có người nhận hợp lệ (có thể đã bị khoá tài khoản).");
  }

  const html = body
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const ok = await sendEmail({ to: actor.email, bcc: validEmails, subject, html });
  if (!ok) {
    throw new ApiError(502, "EMAIL_FAILED", "Không gửi được email — kiểm tra cấu hình Gmail (GMAIL_USER/GMAIL_APP_PASSWORD) trong máy chủ.");
  }

  await logAction(prisma, actor, SYSTEM_LOG_ACTION.SEND_BROADCAST_EMAIL, null, null, {
    subject,
    recipientCount: validEmails.length,
    recipientEmails: validEmails,
  });

  return { sent: validEmails.length };
}
