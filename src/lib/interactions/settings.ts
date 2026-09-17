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

/** Ngưỡng cảnh báo số lần Marketing từng gửi yêu cầu "Chăm sóc lại" cho cùng 1
 * liên hệ (followupResolvedCount, xem pushFollowup() trong mutations.ts) — chỉ
 * dùng để hiển thị/lọc "Sắp chuyển Spam" ở /followup-inbox, không tự động đổi
 * trạng thái. Mặc định 3. */
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

/** Khoá tháng hiện tại theo định dạng "YYYY-MM" — dùng làm key mặc định cho
 * chỉ tiêu KPI tháng (configGroup "kpi"). */
export function currentKpiMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Chỉ tiêu số học viên cần chốt trong 1 tháng cụ thể (configGroup "kpi", key
 * "YYYY-MM") — Admin nhập riêng cho từng tháng ở "Cấu hình hệ thống"; tháng
 * nào chưa nhập thì mặc định 100. */
export async function getMonthlyKpiTarget(month: string = currentKpiMonth()): Promise<number> {
  const raw = await getAppSetting("kpi", month);
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : 100;
}
