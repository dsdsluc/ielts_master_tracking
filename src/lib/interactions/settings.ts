import { prisma } from "@/lib/prisma";

async function getAppSetting(configGroup: string, key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({
    where: { configGroup_key: { configGroup, key } },
  });
  return row?.value ?? null;
}

/** Cửa sổ cảnh báo trùng (giờ) — CONFIG_DUPLICATE.DUP_WINDOW_HOURS, mặc định 24. */
export async function getDuplicateWindowHours(): Promise<number> {
  const raw = await getAppSetting("duplicate", "DUP_WINDOW_HOURS");
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : 24;
}

/** Số lần chăm sóc riêng biệt tối thiểu trước khi đóng Spam vì im lặng — mặc định 3. */
export async function getSpamNoReplyMinAttempts(): Promise<number> {
  const raw = await getAppSetting("system", "SPAM_NO_REPLY_MIN_ATTEMPTS");
  const v = Number(raw);
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 3;
}

/** Số lần "Đánh dấu đã xử lý" chăm sóc lại tối đa trước khi tự động chuyển Spam — mặc định 3. */
export async function getMaxFollowupBeforeSpam(): Promise<number> {
  const raw = await getAppSetting("system", "MAX_FOLLOWUP_BEFORE_SPAM");
  const v = Number(raw);
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 3;
}

/** Bật/tắt thủ công chức năng dọn dẹp trang Chi phí quảng cáo — mặc định tắt. */
export async function isAdsCostCleanupEnabled(): Promise<boolean> {
  const raw = await getAppSetting("system", "ADS_COST_CLEANUP_ENABLED");
  return raw === "true";
}

/** Ngưỡng SLA (giờ) — liên hệ mới tạo quá số giờ này mà vẫn chưa được liên hệ
 * (còn ở trạng thái Chờ) thì tính là quá/sắp quá SLA — mặc định 24. */
export async function getSlaHours(): Promise<number> {
  const raw = await getAppSetting("system", "SLA_HOURS");
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : 24;
}
