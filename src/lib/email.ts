import "server-only";
import nodemailer from "nodemailer";

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

/** Gửi email qua Gmail SMTP (App Password) — không phải nguồn sự thật, chỉ là
 * kênh thông báo phụ, nên KHÔNG BAO GIỜ throw ra ngoài: thiếu cấu hình hoặc
 * gửi lỗi chỉ log cảnh báo và trả về false, để không làm hỏng hành động
 * nghiệp vụ chính (ví dụ Marketing gửi "Chăm sóc lại") chỉ vì email lỗi. */
export async function sendEmail(input: { to: string; bcc?: string[]; subject: string; html: string }): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[email] Chưa cấu hình GMAIL_USER/GMAIL_APP_PASSWORD — bỏ qua gửi: "${input.subject}" tới ${input.to}`);
    return false;
  }
  try {
    await t.sendMail({
      from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
      to: input.to,
      // BCC (không CC) khi gửi đồng loạt cho nhiều thành viên — người nhận
      // không thấy email của nhau.
      bcc: input.bcc?.length ? input.bcc : undefined,
      subject: input.subject,
      html: input.html,
    });
    return true;
  } catch (err) {
    console.error(`[email] Gửi thất bại tới ${input.to}:`, err);
    return false;
  }
}

/** Đường dẫn tuyệt đối vào app để gắn trong email (link tương đối không mở
 * được trong ứng dụng mail) — thiếu APP_URL thì bỏ qua, không chặn gửi mail. */
export function appLink(path: string): string | null {
  const base = process.env.APP_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}${path}`;
}
