import "server-only";
import nodemailer from "nodemailer";
import { getThreadRoots, recordEmailMessage } from "@/lib/email-log";

const FROM_NAME = "Theo dõi Liên hệ · IELTS Master";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  }
  return transporter;
}

export type SendEmailResult = { ok: boolean; messageId?: string };

// Gmail (và hầu hết mail client) chỉ gom 2 email vào cùng 1 cuộc hội thoại
// khi Subject trùng khớp (bỏ qua tiền tố "Re:") NGOÀI việc có chung
// References/In-Reply-To — thiếu 1 trong 2 điều kiện thì vẫn bị tách hội
// thoại dù header đã đúng. Vì vậy khi reply-vào 1 thread có sẵn, PHẢI giữ
// nguyên subject gốc (thêm "Re:") thay vì dùng subject caller truyền vào.
function toReplySubject(originalSubject: string): string {
  const stripped = originalSubject.replace(/^(re|fwd?):\s*/gi, "");
  return `Re: ${stripped}`;
}

/** ĐIỂM GỬI MAIL DUY NHẤT của hệ thống — mọi dịch vụ gửi mail sau này PHẢI đi
 * qua đây (không tự gọi nodemailer riêng), để tự động được 2 việc:
 *  1. Threading: nếu email liên quan tới liên hệ đã từng nhận thông báo
 *     trước đó (interactionIds trùng 1 liên hệ đã có email_messages), tự gắn
 *     In-Reply-To/References VÀ giữ nguyên Subject gốc (thêm "Re:") — Gmail
 *     của người nhận gom chung vào 1 cuộc hội thoại thay vì tách rời từng
 *     mail. Nếu các liên hệ trong batch đang thuộc NHIỀU thread gốc khác
 *     nhau (vd gộp thông báo cho nhiều liên hệ không cùng lịch sử), không
 *     thể khớp subject cho tất cả cùng lúc trong 1 email — giữ nguyên
 *     subject caller truyền vào, chỉ gắn References (vẫn giúp các mail
 *     client dựa thuần vào header, dù Gmail có thể không gom UI).
 *  2. Ghi log vào bảng email_messages (xem lib/email-log.ts) — để BẤT KỲ AI
 *     xem được liên hệ đó cũng xem lại được đã gửi mail gì, không chỉ người
 *     bấm gửi hay người nhận.
 *
 * Không phải nguồn sự thật nghiệp vụ, chỉ là kênh thông báo phụ, nên KHÔNG
 * BAO GIỜ throw ra ngoài: thiếu cấu hình hoặc gửi lỗi chỉ log cảnh báo và trả
 * về { ok: false }, để không làm hỏng hành động nghiệp vụ chính (ví dụ
 * Marketing gửi "Chăm sóc lại") chỉ vì email lỗi. */
export async function sendEmail(input: {
  to: string;
  bcc?: string[];
  // Subject dùng khi email này MỞ 1 cuộc hội thoại mới (chưa có thread trước
  // đó cho các interactionIds truyền vào). Nếu đã có thread, subject thật sự
  // gửi đi sẽ là "Re: <subject gốc của thread>", GHI ĐÈ giá trị này — xem
  // toReplySubject() ở trên.
  subject: string;
  html: string;
  // Tag nghiệp vụ đã tạo ra email này (mirror SYSTEM_LOG_ACTION, vd
  // "FOLLOWUP_ASSIGN") — bắt buộc để mọi email gửi ra đều có ngữ cảnh khi tra
  // lại trong email_messages.
  action: string;
  // Actor đã bấm gửi (null nếu hệ thống tự động gửi, không do ai bấm).
  sentByEmail?: string | null;
  // Các liên hệ mà email này nói tới — dùng để threading + hiển thị lịch sử
  // email trên trang chi tiết liên hệ. Bỏ trống nếu email không gắn với liên
  // hệ cụ thể nào (vd thông báo chung toàn hệ thống).
  interactionIds?: string[];
}): Promise<SendEmailResult> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[email] Chưa cấu hình GMAIL_USER/GMAIL_APP_PASSWORD — bỏ qua gửi: "${input.subject}" tới ${input.to}`);
    return { ok: false };
  }

  const interactionIds = input.interactionIds ?? [];
  const roots = interactionIds.length > 0 ? await getThreadRoots(interactionIds) : [];
  const references = roots.map((r) => r.messageId);
  // Chỉ đổi subject khi tất cả liên hệ trong batch cùng chung đúng 1 thread
  // gốc — nếu đang gộp nhiều thread khác nhau thì không có 1 subject nào
  // khớp được với tất cả, giữ nguyên subject caller truyền vào.
  const subject = roots.length === 1 ? toReplySubject(roots[0].subject) : input.subject;

  try {
    const info = await t.sendMail({
      from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
      to: input.to,
      // BCC (không CC) khi gửi đồng loạt cho nhiều thành viên — người nhận
      // không thấy email của nhau.
      bcc: input.bcc?.length ? input.bcc : undefined,
      subject,
      html: input.html,
      inReplyTo: references[0],
      references: references.length > 0 ? references : undefined,
    });

    try {
      await recordEmailMessage({
        messageId: info.messageId,
        interactionIds,
        toEmail: input.to,
        bccEmails: input.bcc ?? [],
        subject,
        html: input.html,
        action: input.action,
        sentByEmail: input.sentByEmail,
      });
    } catch (err) {
      // Mail đã gửi thành công rồi — lỗi ghi log không được coi là gửi thất
      // bại, chỉ mất phần lịch sử/threading của riêng lần này.
      console.error(`[email] Gửi thành công nhưng ghi log email_messages thất bại (messageId=${info.messageId}):`, err);
    }

    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[email] Gửi thất bại tới ${input.to}:`, err);
    return { ok: false };
  }
}

/** Đường dẫn tuyệt đối vào app để gắn trong email (link tương đối không mở
 * được trong ứng dụng mail) — thiếu APP_URL thì bỏ qua, không chặn gửi mail. */
export function appLink(path: string): string | null {
  const base = process.env.APP_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}${path}`;
}
