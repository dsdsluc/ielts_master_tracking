import "server-only";
import { FOLLOWUP_OUTCOME, INTERACTION_ACTIVITY, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";

type NoteLookupRow = {
  interactionId: string;
  followupOutcome: string | null;
  followupResolvedCount: number;
  followupHandledAt: string | null;
};

/** Tra lại nội dung Sale ghi khi xử lý 1 yêu cầu chăm sóc lại — 2 nguồn khác
 * nhau tuỳ outcome: "Đánh dấu đã xử lý" thủ công (MANUAL_DISMISS, chỉ còn ở dữ
 * liệu cũ) ghi note trực tiếp vào log MKT_PUSH_RESOLVED (khớp theo
 * followupResolvedCount); còn STATUS_CHANGED thì note nằm ở
 * interaction_field_logs (fieldKey=FOLLOWUP_RESOLVED, xem resolveFollowup()/
 * updateStatus() trong mutations.ts) — dòng cũ trước khi có bảng này thì rơi
 * về fallback tra technicalInfo của log UPDATE_RESULT gần nhất trước/đúng
 * thời điểm followupHandledAt như trước đây. */
export async function loadFollowupResolveNotes(rows: NoteLookupRow[]): Promise<Record<string, string | null>> {
  const manualIds = rows
    .filter((r) => r.followupOutcome === FOLLOWUP_OUTCOME.MANUAL_DISMISS)
    .map((r) => r.interactionId);
  const changedIds = rows
    .filter((r) => r.followupOutcome === FOLLOWUP_OUTCOME.STATUS_CHANGED && r.followupHandledAt)
    .map((r) => r.interactionId);

  const [manualLogs, fieldLogs, changedLogs] = await Promise.all([
    manualIds.length
      ? prisma.systemLog.findMany({
          where: { interactionId: { in: manualIds }, action: SYSTEM_LOG_ACTION.MKT_PUSH_RESOLVED },
          select: { interactionId: true, detailNew: true },
        })
      : Promise.resolve([]),
    changedIds.length
      ? prisma.interactionFieldLog.findMany({
          where: { interactionId: { in: changedIds }, fieldKey: INTERACTION_ACTIVITY.FOLLOWUP_RESOLVED },
          select: { interactionId: true, changedAt: true, note: true },
          orderBy: { changedAt: "asc" },
        })
      : Promise.resolve([]),
    // Fallback cho dữ liệu cũ trước khi resolveFollowup()/updateStatus() ghi
    // vào interaction_field_logs — chỉ tra tiếp nếu không thấy ở fieldLogs.
    changedIds.length
      ? prisma.systemLog.findMany({
          where: { interactionId: { in: changedIds }, action: SYSTEM_LOG_ACTION.UPDATE_RESULT, technicalInfo: { not: null } },
          select: { interactionId: true, loggedAt: true, technicalInfo: true },
          orderBy: { loggedAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const notes: Record<string, string | null> = {};

  for (const row of rows) {
    if (row.followupOutcome === FOLLOWUP_OUTCOME.MANUAL_DISMISS) {
      const match = manualLogs.find(
        (l) =>
          l.interactionId === row.interactionId &&
          (l.detailNew as { resolvedCount?: number } | null)?.resolvedCount === row.followupResolvedCount
      );
      notes[row.interactionId] = (match?.detailNew as { note?: string } | null)?.note ?? null;
      continue;
    }
    if (row.followupOutcome === FOLLOWUP_OUTCOME.STATUS_CHANGED && row.followupHandledAt) {
      const handledAt = new Date(row.followupHandledAt).getTime();
      const fieldCandidates = fieldLogs.filter((l) => l.interactionId === row.interactionId && l.changedAt.getTime() <= handledAt);
      const fieldNote = fieldCandidates.at(-1)?.note ?? null;
      if (fieldNote !== null) {
        notes[row.interactionId] = fieldNote;
        continue;
      }
      const legacyCandidates = changedLogs.filter((l) => l.interactionId === row.interactionId && l.loggedAt.getTime() <= handledAt);
      notes[row.interactionId] = legacyCandidates.at(-1)?.technicalInfo ?? null;
      continue;
    }
    notes[row.interactionId] = null;
  }

  return notes;
}
