import "server-only";
import { prisma } from "@/lib/prisma";
import {
  SPAM_REASON,
  STATUS,
  SYSTEM_LOG_ACTION,
} from "@/lib/interactions/constants";
import { SPAM_REASON_OPTIONS } from "@/app/(app)/leads/types";

export type SpamCloseReason = { code: string | null; note: string | null };

/** Tra lý do đóng Spam gần nhất của 1 liên hệ từ nhật ký hệ thống — Interaction
 * không lưu trực tiếp spamReason, chỉ SystemLog (UPDATE_RESULT, detailNew) mới
 * có. Dùng chung giữa bảng "Cần review" và trang chi tiết đóng Spam. */
export async function getLatestSpamReason(
  interactionId: string,
): Promise<SpamCloseReason | null> {
  const logs = await prisma.systemLog.findMany({
    where: { interactionId, action: SYSTEM_LOG_ACTION.UPDATE_RESULT },
    orderBy: { loggedAt: "desc" },
    select: { detailNew: true, technicalInfo: true },
  });
  for (const log of logs) {
    const detail = log.detailNew as {
      status?: string;
      spamReason?: string;
    } | null;
    if (detail?.status === STATUS.SPAM) {
      return { code: detail.spamReason ?? null, note: log.technicalInfo };
    }
  }
  return null;
}

/** Nhãn hiển thị cho mã lý do Spam — trả về chuỗi rỗng khi không rõ (không có
 * log tương ứng), để trang chi tiết bỏ trống thay vì hiện chú thích kỹ thuật. */
export function spamReasonLabel(code: string | null): string {
  if (code === SPAM_REASON.MAX_FOLLOWUP_EXCEEDED)
    return "Hệ thống tự động (vượt số lần chăm sóc lại cho phép)";
  return SPAM_REASON_OPTIONS.find((r) => r.code === code)?.label ?? code ?? "";
}

/** Bản gộp của getLatestSpamReason() cho nhiều liên hệ cùng lúc — dùng ở danh
 * sách (vd. /admin/spam-review) để tránh N+1 query. */
export async function getLatestSpamReasons(
  interactionIds: string[],
): Promise<Map<string, SpamCloseReason>> {
  if (interactionIds.length === 0) return new Map();

  const logs = await prisma.systemLog.findMany({
    where: { interactionId: { in: interactionIds }, action: SYSTEM_LOG_ACTION.UPDATE_RESULT },
    orderBy: { loggedAt: "desc" },
    select: { interactionId: true, detailNew: true, technicalInfo: true },
  });

  const map = new Map<string, SpamCloseReason>();
  for (const log of logs) {
    if (!log.interactionId || map.has(log.interactionId)) continue;
    const detail = log.detailNew as { status?: string; spamReason?: string } | null;
    if (detail?.status === STATUS.SPAM) {
      map.set(log.interactionId, { code: detail.spamReason ?? null, note: log.technicalInfo });
    }
  }
  return map;
}
