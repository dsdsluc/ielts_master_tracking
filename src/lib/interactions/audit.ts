import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { newLogId } from "@/lib/interactions/ids";
import { INTERACTION_ACTIVITY, INTERACTION_ACTIVITY_LABEL } from "@/lib/interactions/constants";
import type { CurrentUser } from "@/lib/auth/dal";

type Tx = Prisma.TransactionClient | PrismaClient;

/** Ghi 1 dòng SYSTEM_LOG — port logAction_(). */
export async function logAction(
  tx: Tx,
  actor: CurrentUser,
  action: string,
  interactionId: string | null,
  detailOld: unknown,
  detailNew: unknown,
  result: "SUCCESS" | "FAIL" = "SUCCESS",
  technicalInfo?: string
) {
  await tx.systemLog.create({
    data: {
      logId: newLogId(),
      loggedAt: new Date(),
      actorEmail: actor.email,
      actorName: actor.fullName,
      actorRole: actor.role,
      action,
      interactionId: interactionId ?? undefined,
      detailOld: (detailOld ?? undefined) as Prisma.InputJsonValue,
      detailNew: (detailNew ?? undefined) as Prisma.InputJsonValue,
      result,
      technicalInfo,
    },
  });
}

/** Ghi 1 dòng SYSTEM_LOG cho hành động HỆ THỐNG tự động (cron, không do ai bấm)
 * — actorEmail để null thay vì gán 1 email giả, vì cột này có khoá ngoại tới
 * users.email (gán email không tồn tại sẽ vi phạm ràng buộc). Các dòng này
 * hiện ở /logs dưới nhóm "Hệ thống / không xác định" (xem SYSTEM_ACTOR_KEY). */
export async function logSystemAction(
  tx: Tx,
  action: string,
  detailNew: unknown,
  result: "SUCCESS" | "FAIL" = "SUCCESS",
  technicalInfo?: string
) {
  await tx.systemLog.create({
    data: {
      logId: newLogId(),
      loggedAt: new Date(),
      actorEmail: null,
      actorName: "Hệ thống (tự động)",
      actorRole: "System",
      action,
      detailOld: undefined,
      detailNew: (detailNew ?? undefined) as Prisma.InputJsonValue,
      result,
      technicalInfo,
    },
  });
}

/** Ghi 1 dòng "lịch sử của liên hệ" vào interaction_field_logs — dùng cho mọi
 * hoạt động KHÔNG PHẢI sửa field (chăm sóc, đổi trạng thái, chăm sóc lại,
 * điều chuyển...), nguồn duy nhất cho các box "Lịch sử..." trên trang chi
 * tiết liên hệ. Việc sửa field cụ thể vẫn ghi trực tiếp qua
 * tx.interactionFieldLog.createMany() ở updateInteractionInfo() (mutations.ts)
 * vì đã có oldValue/newValue rõ ràng theo từng field, không cần qua đây. */
export async function logInteractionActivity(
  tx: Tx,
  actor: CurrentUser,
  interactionId: string,
  activity: (typeof INTERACTION_ACTIVITY)[keyof typeof INTERACTION_ACTIVITY],
  options: { oldValue?: string | null; newValue?: string | null; note?: string | null } = {}
) {
  await tx.interactionFieldLog.create({
    data: {
      interactionId,
      fieldKey: activity,
      fieldLabel: INTERACTION_ACTIVITY_LABEL[activity],
      oldValue: options.oldValue ?? null,
      newValue: options.newValue ?? null,
      note: options.note ?? null,
      changedByEmail: actor.email,
      changedByName: actor.fullName,
    },
  });
}
