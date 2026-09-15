import "server-only";
import { prisma } from "@/lib/prisma";

export type ThreadRoot = { messageId: string; subject: string };

/** Email GỐC (đầu tiên) của từng liên hệ trong danh sách — dùng để thread
 * email tiếp theo vào cùng 1 cuộc hội thoại. Gmail (và hầu hết mail client)
 * gom hội thoại theo CẢ HAI: header References/In-Reply-To VÀ Subject trùng
 * khớp (bỏ qua tiền tố "Re:") — chỉ gắn References mà đổi Subject khác đi thì
 * Gmail vẫn tách thành 2 hội thoại riêng, nên phải trả về cả subject gốc để
 * sendEmail() giữ nguyên dòng tiêu đề khi reply-vào. Nếu nhiều liên hệ trong
 * batch đã có thread khác nhau, trả về đủ các root (không thể vừa khít
 * subject cho tất cả cùng lúc trong 1 email, xem sendEmail()). */
export async function getThreadRoots(interactionIds: string[]): Promise<ThreadRoot[]> {
  if (interactionIds.length === 0) return [];

  const rows = await prisma.emailMessageInteraction.findMany({
    where: { interactionId: { in: interactionIds } },
    orderBy: { emailMessage: { sentAt: "asc" } },
    select: { interactionId: true, emailMessage: { select: { messageId: true, subject: true } } },
  });

  // rows đã sắp theo sentAt tăng dần — bản ghi đầu tiên gặp mỗi interactionId
  // chính là root (email cũ nhất từng nhắc tới liên hệ đó).
  const rootByInteraction = new Map<string, ThreadRoot>();
  for (const row of rows) {
    if (!rootByInteraction.has(row.interactionId)) {
      rootByInteraction.set(row.interactionId, { messageId: row.emailMessage.messageId, subject: row.emailMessage.subject });
    }
  }

  const seen = new Set<string>();
  const roots: ThreadRoot[] = [];
  for (const root of rootByInteraction.values()) {
    if (!seen.has(root.messageId)) {
      seen.add(root.messageId);
      roots.push(root);
    }
  }
  return roots;
}

/** Ghi lại 1 email ĐÃ GỬI THÀNH CÔNG — gọi từ sendEmail() sau khi SMTP xác
 * nhận, không gọi trực tiếp từ nơi khác để tránh ghi trùng/thiếu. Gửi thất
 * bại thì không có messageId hợp lệ nên không có gì để ghi (console.error ở
 * sendEmail() đã đủ để biết lỗi). */
export async function recordEmailMessage(input: {
  messageId: string;
  interactionIds: string[];
  toEmail: string;
  bccEmails: string[];
  subject: string;
  html: string;
  action: string;
  sentByEmail?: string | null;
}) {
  await prisma.emailMessage.create({
    data: {
      messageId: input.messageId,
      toEmail: input.toEmail,
      bccEmails: input.bccEmails,
      subject: input.subject,
      html: input.html,
      action: input.action,
      sentByEmail: input.sentByEmail ?? null,
      interactions: {
        create: input.interactionIds.map((interactionId) => ({ interactionId })),
      },
    },
  });
}

/** Lịch sử email liên quan tới 1 liên hệ, mới nhất trước — hiển thị ở trang
 * chi tiết liên hệ để BẤT KỲ AI xem được liên hệ này cũng xem được đã gửi
 * mail gì về nó, không chỉ riêng người bấm gửi. */
export async function getEmailMessagesForInteraction(interactionId: string) {
  const rows = await prisma.emailMessageInteraction.findMany({
    where: { interactionId },
    orderBy: { emailMessage: { sentAt: "desc" } },
    select: {
      emailMessage: {
        select: {
          id: true,
          subject: true,
          html: true,
          toEmail: true,
          bccEmails: true,
          action: true,
          sentAt: true,
          sentBy: { select: { fullName: true, email: true } },
        },
      },
    },
  });
  return rows.map((r) => r.emailMessage);
}
