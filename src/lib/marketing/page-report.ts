// Báo cáo Page hằng ngày — cohort theo NGÀY TẠO lead, không phải ngày xin
// được SĐT. Trước khi chốt: đọc trực tiếp từ Interaction (số liệu "sống",
// tự đổi nếu lead cũ trong ngày đó sau này xin được SĐT). Sau khi chốt: đọc
// snapshot cố định trong mkt_page_reports, không tính lại nữa.
import { prisma } from "@/lib/prisma";
import { EXTERNAL_LEAD_FANPAGE, ROLES, STATUS, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { logAction } from "@/lib/interactions/audit";
import { ApiError } from "@/lib/interactions/errors";
import type { CurrentUser } from "@/lib/auth/dal";

export type SourceBreakdownRow = { sourceName: string; count: number };

export type PageReportRow = {
  fanpageName: string;
  totalLeads: number;
  qualifiedLeads: number;
  conversionRate: number;
  closed: boolean;
  closedAt: string | null;
  closedByName: string | null;
  // Chỉ có ở đúng 1 dòng "Ngoài kênh online" (EXTERNAL_LEAD_FANPAGE) — dòng
  // này gộp chung MỌI nguồn ngoài (Zalo/TikTok/Giới thiệu/Khác) vì chúng
  // không thuộc Page/Fanpage thật nào, nên cần tách hiển thị theo Nguồn ngay
  // trong bảng chính để Marketing thấy được từng kênh, không chỉ 1 con số gộp.
  sourceBreakdown?: SourceBreakdownRow[];
};

/** yyyy-MM-dd (giờ địa phương server) -> khoảng [đầu ngày, đầu ngày kế tiếp). */
export function parseDayRange(dateStr: string): { dayStart: Date; dayEnd: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) throw new ApiError(422, "VALIDATION_ERROR", "Ngày không hợp lệ.");
  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { dayStart, dayEnd };
}

function requireCanClose(actor: CurrentUser) {
  if (actor.role !== ROLES.ADMIN && !actor.canCloseMktReport) {
    throw new ApiError(403, "FORBIDDEN", "Bạn không có quyền chốt báo cáo Marketing — liên hệ Quản trị hệ thống để được cấp quyền.");
  }
}

async function computeLive(dayStart: Date, dayEnd: Date, fanpageName: string) {
  const [totalLeads, qualifiedLeads] = await Promise.all([
    prisma.interaction.count({ where: { fanpageName, activeFlag: true, createdLeadAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.interaction.count({
      where: { fanpageName, activeFlag: true, createdLeadAt: { gte: dayStart, lt: dayEnd }, statusName: STATUS.PHONE },
    }),
  ]);
  return { totalLeads, qualifiedLeads };
}

async function getExternalSourceBreakdown(dayStart: Date, dayEnd: Date): Promise<SourceBreakdownRow[]> {
  const groups = await prisma.interaction.groupBy({
    by: ["sourceName"],
    where: { fanpageName: EXTERNAL_LEAD_FANPAGE, activeFlag: true, createdLeadAt: { gte: dayStart, lt: dayEnd } },
    _count: { _all: true },
  });
  return groups.map((g) => ({ sourceName: g.sourceName, count: g._count._all })).sort((a, b) => b.count - a.count);
}

export async function getPageReportRows(dateStr: string): Promise<PageReportRow[]> {
  const { dayStart, dayEnd } = parseDayRange(dateStr);

  const [fanpages, existingReports, externalBreakdown] = await Promise.all([
    prisma.fanpage.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.mktPageReport.findMany({ where: { reportDate: dayStart }, include: { closedBy: { select: { fullName: true } } } }),
    getExternalSourceBreakdown(dayStart, dayEnd),
  ]);

  const reportByFanpage = new Map(existingReports.map((r) => [r.fanpageName, r]));

  return Promise.all(
    fanpages.map(async ({ name: fanpageName }) => {
      // Luôn tính "sống" theo Nguồn (không đóng băng theo lần chốt) — đây là
      // thông tin hỗ trợ xem/đối chiếu, không phải số liệu cam kết của báo cáo.
      const sourceBreakdown = fanpageName === EXTERNAL_LEAD_FANPAGE ? externalBreakdown : undefined;

      const existing = reportByFanpage.get(fanpageName);
      if (existing?.closedAt) {
        const totalLeads = existing.totalLeads ?? 0;
        const qualifiedLeads = existing.qualifiedLeads ?? 0;
        return {
          fanpageName,
          totalLeads,
          qualifiedLeads,
          conversionRate: totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0,
          closed: true,
          closedAt: existing.closedAt.toISOString(),
          closedByName: existing.closedBy?.fullName ?? null,
          sourceBreakdown,
        };
      }
      const { totalLeads, qualifiedLeads } = await computeLive(dayStart, dayEnd, fanpageName);
      return {
        fanpageName,
        totalLeads,
        qualifiedLeads,
        conversionRate: totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0,
        closed: false,
        closedAt: null,
        closedByName: null,
        sourceBreakdown,
      };
    })
  );
}

export type PageReportLeadDetail = {
  interactionId: string;
  customerName: string;
  sourceName: string;
  phoneNormalized: string | null;
  statusName: string;
  createdLeadAt: string;
};

/** Danh sách liên hệ CỤ THỂ đã gộp thành totalLeads/qualifiedLeads của 1
 * Page trong ngày — cho Marketing đối chiếu trước khi chốt (vd. thấy trên
 * chính Page là 10 tin nhắn nhưng hệ thống chỉ đang đếm 1, thì mở ra xem
 * ngay THIẾU đúng những liên hệ nào để yêu cầu bổ sung/sửa lại). Luôn đọc
 * "sống" từ Interaction — kể cả khi báo cáo Page đã chốt (đây là dữ liệu hỗ
 * trợ xem lại, không phải số liệu đóng băng của báo cáo). */
export async function getPageReportLeadDetails(dateStr: string, fanpageName: string): Promise<PageReportLeadDetail[]> {
  const { dayStart, dayEnd } = parseDayRange(dateStr);
  const rows = await prisma.interaction.findMany({
    where: { fanpageName, activeFlag: true, createdLeadAt: { gte: dayStart, lt: dayEnd } },
    orderBy: { createdLeadAt: "asc" },
    select: { interactionId: true, customerName: true, sourceName: true, phoneNormalized: true, statusName: true, createdLeadAt: true },
  });
  return rows.map((r) => ({ ...r, createdLeadAt: r.createdLeadAt.toISOString() }));
}

export async function closePageReport(actor: CurrentUser, dateStr: string, fanpageName: string) {
  requireCanClose(actor);
  const { dayStart, dayEnd } = parseDayRange(dateStr);

  const fanpage = await prisma.fanpage.findUnique({ where: { name: fanpageName } });
  if (!fanpage) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy Page này.");

  const { totalLeads, qualifiedLeads } = await computeLive(dayStart, dayEnd, fanpageName);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.mktPageReport.upsert({
      where: { reportDate_fanpageName: { reportDate: dayStart, fanpageName } },
      create: { reportDate: dayStart, fanpageName, totalLeads, qualifiedLeads, closedAt: now, closedByEmail: actor.email },
      update: { totalLeads, qualifiedLeads, closedAt: now, closedByEmail: actor.email },
    });
    await logAction(tx, actor, SYSTEM_LOG_ACTION.CLOSE_MKT_PAGE_REPORT, null, null, {
      reportDate: dateStr,
      fanpageName,
      totalLeads,
      qualifiedLeads,
    });
  });

  return { totalLeads, qualifiedLeads };
}

export async function closeAllPageReports(actor: CurrentUser, dateStr: string) {
  requireCanClose(actor);
  const rows = await getPageReportRows(dateStr);
  let closed = 0;
  for (const row of rows) {
    if (row.closed) continue;
    await closePageReport(actor, dateStr, row.fanpageName);
    closed++;
  }
  return { closed, total: rows.length };
}

export async function reopenPageReport(actor: CurrentUser, dateStr: string, fanpageName: string) {
  const { dayStart } = parseDayRange(dateStr);

  await prisma.$transaction(async (tx) => {
    await tx.mktPageReport.updateMany({
      where: { reportDate: dayStart, fanpageName },
      data: { closedAt: null, closedByEmail: null, totalLeads: null, qualifiedLeads: null },
    });
    await logAction(tx, actor, SYSTEM_LOG_ACTION.REOPEN_MKT_PAGE_REPORT, null, null, { reportDate: dateStr, fanpageName });
  });
}
