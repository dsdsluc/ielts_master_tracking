import "server-only";
// Công thức "hôm nay đã làm được gì" dùng chung giữa /daily-report (1 người
// xem trực tiếp) và email "Báo cáo nhanh" 7h sáng (/api/cron/daily-report-email)
// — tách riêng ra đây để 2 nơi LUÔN khớp số, sửa 1 chỗ áp dụng cả 2. Truyền
// `actorEmail` để tính cho ĐÚNG 1 người; bỏ trống để tính TOÀN CÔNG TY (gộp
// mọi Sale/Leader, dùng cho phần "Báo cáo chi nhánh" của email).
import { prisma } from "@/lib/prisma";
import { SYSTEM_LOG_ACTION, CUSTOMER_STAGE } from "@/lib/interactions/constants";

export type DailySummary = {
  newLeadsToday: number;
  oldCustomersContactedToday: number;
  testScheduledToday: number;
  consultedToday: number;
  enrolledToday: number;
};

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function computeDailySummary(actorEmail?: string): Promise<DailySummary> {
  const start = todayStart();

  const [newLeadsToday, careLogRows, stageLogsToday] = await Promise.all([
    prisma.customer.count({
      where: { assignedAt: { gte: start }, assignedToEmail: actorEmail ?? { not: null } },
    }),
    prisma.customerCareLog.findMany({
      where: { loggedAt: { gte: start }, ...(actorEmail ? { loggedByEmail: actorEmail } : {}) },
      select: { customerKey: true },
    }),
    prisma.systemLog.findMany({
      where: { action: SYSTEM_LOG_ACTION.UPDATE_CUSTOMER_STAGE, loggedAt: { gte: start }, ...(actorEmail ? { actorEmail } : {}) },
      select: { detailNew: true },
    }),
  ]);

  // "Khách cũ đã liên hệ" — khách KHÔNG mới nhận hôm nay (đã được giao từ
  // trước) nhưng hôm nay có ít nhất 1 lượt "Ghi nhận chăm sóc", đếm theo
  // khách duy nhất (xem comment gốc ở app/(app)/daily-report/page.tsx).
  const caredCustomerKeys = [...new Set(careLogRows.map((r) => r.customerKey))];
  const caredCustomers = caredCustomerKeys.length
    ? await prisma.customer.findMany({ where: { customerKey: { in: caredCustomerKeys } }, select: { assignedAt: true } })
    : [];
  const oldCustomersContactedToday = caredCustomers.filter((c) => !c.assignedAt || c.assignedAt < start).length;

  // Nhóm theo mốc tư vấn MỚI trong ngày, khách duy nhất — mirror stageGroups
  // ở page.tsx.
  const stageGroups = new Map<string, Set<string>>();
  for (const log of stageLogsToday) {
    const detail = log.detailNew as { customerKey?: string; stage?: string } | null;
    if (!detail?.customerKey || !detail.stage) continue;
    const set = stageGroups.get(detail.stage) ?? new Set<string>();
    set.add(detail.customerKey);
    stageGroups.set(detail.stage, set);
  }
  const testScheduledToday = new Set([...(stageGroups.get(CUSTOMER_STAGE.TEST_SCHEDULED) ?? []), ...(stageGroups.get(CUSTOMER_STAGE.TRIAL_SCHEDULED) ?? [])]).size;
  const consultedToday = new Set([...(stageGroups.get(CUSTOMER_STAGE.TESTED) ?? []), ...(stageGroups.get(CUSTOMER_STAGE.TRIALED) ?? [])]).size;
  const enrolledToday = stageGroups.get(CUSTOMER_STAGE.ENROLLED)?.size ?? 0;

  return { newLeadsToday, oldCustomersContactedToday, testScheduledToday, consultedToday, enrolledToday };
}
