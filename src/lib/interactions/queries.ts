// Truy vấn đọc (list/queue/detail) cho Interaction — cặp đôi với mutations.ts
// (ghi). Tách riêng vì mutations.ts cần gọi getInteractionDetail() sau khi ghi
// xong trong cùng transaction, nên không thể đặt phần đọc lẫn trong 1 file
// import vòng lẫn nhau.
import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  INTERACTION_ACTIVITY,
  ROLES,
  STATUS,
  canonicalStatusKey,
  isOpenStatus,
} from "@/lib/interactions/constants";
import { Errors } from "@/lib/interactions/errors";
import { canAccessBranch, canViewLead, isLeaderLike } from "@/lib/interactions/scope";
import { detailInclude, listItemInclude, toDetail, toListItem } from "@/lib/interactions/serialize";
import type { CurrentUser } from "@/lib/auth/dal";
import type { InteractionDetail, InteractionListItem, LeadQueue, LeadQueueGroup } from "@/lib/interactions/types";

type Tx = Prisma.TransactionClient | PrismaClient;

export type BranchSla = { slaReceiveMinutes: number; slaProcessHours: number };

/** Ngưỡng SLA nhận (phút) / xử lý (giờ) theo TỪNG cơ sở — đúng như Admin cấu
 * hình ở /admin/catalog (`Branch.slaReceiveMinutes`/`slaProcessHours`), thay
 * cho 1 mốc chung toàn hệ thống trước đây. Trả kèm 1 ngưỡng mặc định (30
 * phút/24 giờ) cho liên hệ không xác định được cơ sở. */
export async function getBranchSlaMap(): Promise<{ byCode: Map<string, BranchSla>; fallback: BranchSla }> {
  const branches = await prisma.branch.findMany({ select: { code: true, slaReceiveMinutes: true, slaProcessHours: true } });
  return {
    byCode: new Map(branches.map((b) => [b.code, { slaReceiveMinutes: b.slaReceiveMinutes, slaProcessHours: b.slaProcessHours }])),
    fallback: { slaReceiveMinutes: 30, slaProcessHours: 24 },
  };
}

/** Cùng điều kiện "quá hạn" mà trang /sla-queue dùng để lọc — tách ra đây để
 * dùng chung, tránh 2 nơi định nghĩa lệch nhau: đang "Chờ" (chưa Sale nào
 * liên hệ) và đã trôi qua đủ slaReceiveMinutes của cơ sở phụ trách. */
export function computeSlaOverdue(
  item: Pick<InteractionListItem, "status" | "assignedBranchCode" | "createdLeadAt">,
  slaByBranch: Map<string, BranchSla>,
  slaFallback: BranchSla,
  now: number = Date.now()
): boolean {
  if (item.status !== STATUS.WAITING) return false;
  const sla = slaByBranch.get(item.assignedBranchCode) ?? slaFallback;
  return new Date(item.createdLeadAt).getTime() <= now - sla.slaReceiveMinutes * 60_000;
}

/**
 * Phạm vi cơ sở actor được xem, dùng làm điều kiện WHERE cho list/queue —
 * mirror canAccessBranch/canViewLead (scope.ts) nhưng ở dạng gộp cho query
 * thay vì kiểm tra từng dòng.
 */
export function branchScopeWhere(actor: CurrentUser): Prisma.InteractionWhereInput {
  if (isLeaderLike(actor)) return {};
  if (actor.role === ROLES.SALES) return { assignedBranchCode: actor.branchCode ?? "__NONE__" };
  if (actor.viewAllBranches) return {};
  return actor.branchCode ? { assignedBranchCode: actor.branchCode } : {};
}

/** Sale/Leader/Admin đang hoạt động — danh sách chọn khi điều chuyển người
 * phụ trách (reassignInteraction). Leader/Admin đã thấy toàn bộ chi nhánh
 * (isLeaderLike ở scope.ts) nên không cần lọc theo cơ sở actor. */
export async function getAssignableSalesForReassign() {
  return prisma.user.findMany({
    where: { role: { in: [ROLES.SALES, ROLES.LEADER, ROLES.ADMIN] }, active: true },
    select: { email: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}

function buildPermissions(actor: CurrentUser, lead: { statusName: string; assignedBranchCode: string; needsFollowup: boolean }): InteractionDetail["permissions"] {
  const accessible = canAccessBranch(actor, lead.assignedBranchCode);
  const open = isOpenStatus(lead.statusName);

  return {
    canEditInfo: isLeaderLike(actor) || (actor.role === ROLES.SALES && accessible && open),
    canUpdateStatus: isLeaderLike(actor) || (accessible && open),
    canReassign: canonicalStatusKey(lead.statusName) === "PHONE",
    canRequestFollowup: open && !lead.needsFollowup,
    canResolveFollowup: accessible && lead.needsFollowup,
  };
}

export async function getInteractionDetail(actor: CurrentUser, interactionId: string, tx: Tx = prisma): Promise<InteractionDetail> {
  const row = await tx.interaction.findUnique({ where: { interactionId }, include: detailInclude });
  if (!row) throw Errors.notFound();
  if (!canViewLead(actor, row.assignedBranchCode)) throw Errors.forbidden("Bạn không được xem hội thoại này.");

  const [customerHistoryRows, touchLogs, emailMessageRows, fieldLogRows] = await Promise.all([
    // customerKey chỉ có giá trị khi Đủ tiêu chuẩn — chưa có thì chưa có gì để
    // tra lịch sử (where: { customerKey: null } sẽ khớp NHẦM mọi liên hệ khác
    // cũng đang null, không phải lịch sử thật của khách này).
    row.customerKey
      ? tx.interaction.findMany({
          where: { customerKey: row.customerKey, interactionId: { not: interactionId } },
          include: listItemInclude,
          orderBy: { createdLeadAt: "desc" },
        })
      : Promise.resolve([]),
    // "Lịch sử chăm sóc" — đọc từ interaction_field_logs (fieldKey=TOUCH), KHÔNG
    // còn từ SystemLog nữa (xem logInteractionActivity() trong audit.ts).
    tx.interactionFieldLog.findMany({
      where: { interactionId, fieldKey: INTERACTION_ACTIVITY.TOUCH },
      orderBy: { changedAt: "desc" },
      select: { changedAt: true, changedByName: true, changedByEmail: true, note: true },
    }),
    tx.emailMessageInteraction.findMany({
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
            sentBy: { select: { fullName: true } },
          },
        },
      },
    }),
    // "Lịch sử chỉnh sửa thông tin" — chỉ đúng các dòng sửa field thật, loại
    // trừ các mã hoạt động chung (TOUCH/STATUS_CHANGE/FOLLOWUP_*/REASSIGN)
    // cũng đang ghi chung bảng này (xem comment InteractionFieldLog ở schema).
    tx.interactionFieldLog.findMany({
      where: { interactionId, fieldKey: { notIn: Object.values(INTERACTION_ACTIVITY) } },
      orderBy: { changedAt: "desc" },
      select: { fieldLabel: true, oldValue: true, newValue: true, changedByName: true, changedAt: true },
    }),
  ]);

  return toDetail(row, {
    permissions: buildPermissions(actor, row),
    customerHistory: customerHistoryRows.map(toListItem),
    touchLog: touchLogs.map((l) => ({
      loggedAt: l.changedAt.toISOString(),
      actorName: l.changedByName,
      actorEmail: l.changedByEmail,
      note: l.note,
    })),
    emailMessages: emailMessageRows.map((r) => ({
      id: r.emailMessage.id,
      subject: r.emailMessage.subject,
      html: r.emailMessage.html,
      toEmail: r.emailMessage.toEmail,
      bccEmails: r.emailMessage.bccEmails,
      action: r.emailMessage.action,
      sentAt: r.emailMessage.sentAt.toISOString(),
      sentByName: r.emailMessage.sentBy?.fullName ?? null,
    })),
    fieldChangeLog: fieldLogRows.map((r) => ({
      fieldLabel: r.fieldLabel,
      oldValue: r.oldValue,
      newValue: r.newValue,
      changedByName: r.changedByName,
      changedAt: r.changedAt.toISOString(),
    })),
  });
}

export type FollowupHistoryEntry = {
  action: string;
  loggedAt: string;
  actorName: string;
  note: string | null;
  suggestion: string | null;
};

/** Lịch sử riêng của vòng đời "Cần chăm sóc lại" cho 1 liên hệ — dùng ở trang
 * chi tiết yêu cầu chăm sóc lại (/followup-inbox/[id]), khác với touchLog
 * (lịch sử chăm sóc chung) ở chỗ chỉ gồm đúng 3 mốc: Marketing gửi yêu cầu,
 * Leader phân bổ Sale, Sale đánh dấu đã chăm sóc lại xong. Đọc từ
 * interaction_field_logs (không còn từ SystemLog) — xem logInteractionActivity(). */
export async function getFollowupHistory(interactionId: string): Promise<FollowupHistoryEntry[]> {
  const rows = await prisma.interactionFieldLog.findMany({
    where: {
      interactionId,
      fieldKey: { in: [INTERACTION_ACTIVITY.FOLLOWUP_PUSH, INTERACTION_ACTIVITY.FOLLOWUP_ASSIGN, INTERACTION_ACTIVITY.FOLLOWUP_RESOLVED] },
    },
    orderBy: { changedAt: "asc" },
    select: { fieldKey: true, changedAt: true, changedByName: true, note: true, newValue: true },
  });

  return rows.map((r) => ({
    action: r.fieldKey,
    loggedAt: r.changedAt.toISOString(),
    actorName: r.changedByName,
    note: r.note,
    suggestion: r.fieldKey === INTERACTION_ACTIVITY.FOLLOWUP_PUSH ? r.newValue : null,
  }));
}

export type ListInteractionsParams = {
  status?: string; // 1 giá trị, hoặc nhiều giá trị nối dấu phẩy
  mine?: boolean;
  branch?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type ListInteractionsResult = {
  items: InteractionListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

/** Dùng chung giữa listInteractions (phân trang) và route export (lấy toàn bộ). */
export function buildInteractionWhere(actor: CurrentUser, params: Omit<ListInteractionsParams, "page" | "pageSize">): Prisma.InteractionWhereInput {
  // Liên hệ đang "Cần chăm sóc lại" chỉ hiển thị ở /followup-inbox (và
  // /followup, /followup-tracking cho Marketing/Leader) — trang Liên hệ không
  // lặp lại tập này nữa để tránh 2 nơi cùng là "nơi xử lý" 1 liên hệ.
  const where: Prisma.InteractionWhereInput = { ...branchScopeWhere(actor), activeFlag: true, needsFollowup: false };
  // "mine" và "search" đều cần diễn đạt bằng OR — không thể gán trực tiếp 2 lần
  // vào where.OR (key sau sẽ đè key trước), nên mỗi OR-block được gom vào đây
  // và kết hợp lại bằng AND ở cuối.
  const andConditions: Prisma.InteractionWhereInput[] = [];

  if (params.status) {
    const statuses = params.status.split(",").map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) where.statusName = statuses[0];
    else if (statuses.length > 1) where.statusName = { in: statuses };
  }
  if (params.mine) {
    // Một nguồn sự thật duy nhất: "Của tôi" là liên hệ mà actor đang là Tư vấn viên.
    where.assignedSaleEmail = actor.email;
  }
  if (params.branch && params.branch !== "all") {
    // Bộ lọc cơ sở trên UI chỉ được thu hẹp thêm, không được mở rộng ra ngoài
    // phạm vi actor vốn đã được phép xem.
    if (!canAccessBranch(actor, params.branch)) throw Errors.forbidden("Bạn không được xem cơ sở này.");
    where.assignedBranchCode = params.branch;
  }
  if (params.search) {
    const needle = params.search.trim();
    if (needle) {
      // Tìm theo tên khách, SĐT (thô lẫn đã chuẩn hoá) và link — khớp các cột
      // người dùng thực sự gõ vào ô tìm kiếm trên UI (leads-queue-view.tsx).
      andConditions.push({
        OR: [
          { customerName: { contains: needle, mode: "insensitive" } },
          { phoneNormalized: { contains: needle, mode: "insensitive" } },
          { phoneRaw: { contains: needle, mode: "insensitive" } },
          { rawLink: { contains: needle, mode: "insensitive" } },
          { canonicalLink: { contains: needle, mode: "insensitive" } },
        ],
      });
    }
  }

  if (andConditions.length > 0) where.AND = andConditions;

  return where;
}

export async function listInteractions(actor: CurrentUser, params: ListInteractionsParams): Promise<ListInteractionsResult> {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? Math.min(Math.floor(params.pageSize), 100) : 20;

  const where = buildInteractionWhere(actor, params);

  const [totalItems, rows, { byCode: slaByBranch, fallback: slaFallback }] = await Promise.all([
    prisma.interaction.count({ where }),
    prisma.interaction.findMany({
      where,
      include: listItemInclude,
      orderBy: { createdLeadAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    getBranchSlaMap(),
  ]);

  const now = Date.now();
  const items = rows.map(toListItem).map((item) => ({ ...item, slaOverdue: computeSlaOverdue(item, slaByBranch, slaFallback, now) }));

  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };
}

// Tab "Đủ tiêu chuẩn" ở /leads chỉ cần soi lại các lead MỚI chuyển đủ điều
// kiện gần đây — khác với Chờ/Tiếp nhận (tự nhiên luôn ít vì lead không nằm
// lâu ở đó), Đủ tiêu chuẩn là trạng thái vĩnh viễn nên tập đầy đủ sẽ phình to
// dần theo thời gian dùng hệ thống. Xem lịch sử toàn bộ ở /customers.
const QUALIFIED_QUEUE_WINDOW_DAYS = 30;

/**
 * Snapshot đầy đủ cho trang /leads. Trang này thực hiện search/filter/sort/
 * phân trang ở client cho 3 tab (Chờ/Tiếp nhận/Đủ tiêu chuẩn gần đây), nên một
 * query duy nhất nhẹ hơn việc gọi lại DB sau mỗi thao tác giao diện. Phạm vi
 * chi nhánh và điều kiện loại lead cần chăm sóc lại vẫn dùng chung
 * buildInteractionWhere().
 */
export async function listOpenInteractions(actor: CurrentUser): Promise<InteractionListItem[]> {
  const qualifiedSince = new Date(Date.now() - QUALIFIED_QUEUE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const where: Prisma.InteractionWhereInput = {
    ...buildInteractionWhere(actor, {}),
    OR: [
      { statusName: { in: [STATUS.WAITING, STATUS.PROCESSING] } },
      { statusName: STATUS.PHONE, phoneCapturedAt: { gte: qualifiedSince } },
    ],
  };
  const [rows, { byCode: slaByBranch, fallback: slaFallback }] = await Promise.all([
    prisma.interaction.findMany({
      where,
      include: listItemInclude,
      orderBy: [{ createdLeadAt: "desc" }, { interactionId: "desc" }],
    }),
    getBranchSlaMap(),
  ]);

  const now = Date.now();
  return rows.map(toListItem).map((item) => ({ ...item, slaOverdue: computeSlaOverdue(item, slaByBranch, slaFallback, now) }));
}

const QUEUE_GROUP_LABELS: Record<Exclude<LeadQueueGroup["key"], "recently_closed">, string> = {
  new_waiting: "Mới đang Chờ",
  sla_breaching: "Sắp/đã quá SLA",
  processing_no_phone: "Tiếp nhận, chưa có SĐT",
};
const QUEUE_ORDER = ["new_waiting", "sla_breaching", "processing_no_phone"] as const;
// Trần an toàn để tránh payload quá lớn — phân trang thật trong mỗi nhóm nằm
// ở client (leads-queue-view.tsx), vì việc gộp nhóm (loại trừ lẫn nhau, phụ
// thuộc SLA theo cơ sở) phải tính trên toàn bộ tập mở nên khó tách theo trang ở DB.
const QUEUE_GROUP_CAP = 200;
// "Sắp quá SLA" tính từ % thời gian mốc đã trôi qua, không chỉ khi đã breach hẳn.
const SLA_APPROACH_RATIO = 0.8;

async function computePersonalKpi(actor: CurrentUser): Promise<LeadQueue["personalKpi"]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const rows = await prisma.interaction.groupBy({
    by: ["statusName"],
    where: { ...branchScopeWhere(actor), activeFlag: true, createdLeadAt: { gte: startOfDay } },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(rows.map((r) => [r.statusName, r._count._all])) as Record<string, number>;
  const waiting = counts[STATUS.WAITING] ?? 0;
  const processing = counts[STATUS.PROCESSING] ?? 0;
  const qualified = counts[STATUS.PHONE] ?? 0;
  const spam = counts[STATUS.SPAM] ?? 0;
  const totalToday = waiting + processing + qualified + spam;

  return { totalToday, waiting, processing, qualified, spam, qualifiedRate: totalToday > 0 ? qualified / totalToday : null };
}

/**
 * Hàng đợi ưu tiên: mới đang Chờ → sắp/đã quá SLA → Tiếp nhận chưa có SĐT
 * (đúng thứ tự banner ở trang Liên hệ). Mỗi lead chỉ rơi vào ĐÚNG 1 nhóm —
 * nhóm đầu tiên khớp theo thứ tự trên thắng, để không hiển thị trùng lặp
 * giữa các nhóm. Liên hệ "Cần chăm sóc lại" bị loại ngay từ truy vấn — chỉ
 * hiển thị ở /followup-inbox, tránh trang Liên hệ và Workspace lặp lại cùng
 * 1 tập với nơi đó (mirror buildInteractionWhere()).
 *
 * SLA tính theo TỪNG cơ sở (Branch.slaReceiveMinutes/slaProcessHours, sửa ở
 * /admin/catalog) — không còn 1 mốc chung toàn hệ thống. "Chờ" quá
 * slaReceiveMinutes = chưa ai liên hệ kịp; "Tiếp nhận" quá slaProcessHours =
 * đã liên hệ nhưng xử lý (xin SĐT) quá lâu. Lưu ý: schema không có mốc "vào
 * Tiếp nhận" riêng, nên dùng createdLeadAt (giờ tạo lead) làm gốc đo cho cả 2
 * trạng thái — chấp nhận đây là ước lượng, không phải SLA xử lý tuyệt đối chính xác.
 */
export async function getQueue(actor: CurrentUser): Promise<LeadQueue> {
  const [{ byCode: slaByBranch, fallback: slaFallback }, openRows, personalKpi] = await Promise.all([
    getBranchSlaMap(),
    prisma.interaction.findMany({
      where: { ...branchScopeWhere(actor), activeFlag: true, needsFollowup: false, statusName: { in: [STATUS.WAITING, STATUS.PROCESSING] } },
      include: listItemInclude,
      orderBy: { createdLeadAt: "asc" },
    }),
    computePersonalKpi(actor),
  ]);

  const now = Date.now();
  const buckets: Record<(typeof QUEUE_ORDER)[number], InteractionListItem[]> = {
    new_waiting: [],
    sla_breaching: [],
    processing_no_phone: [],
  };

  for (const row of openRows) {
    const sla = slaByBranch.get(row.assignedBranchCode) ?? slaFallback;
    const elapsedMinutes = (now - row.createdLeadAt.getTime()) / 60000;
    const isReceiveBreaching = row.statusName === STATUS.WAITING && elapsedMinutes >= sla.slaReceiveMinutes * SLA_APPROACH_RATIO;
    const isProcessBreaching = row.statusName === STATUS.PROCESSING && elapsedMinutes >= sla.slaProcessHours * 60 * SLA_APPROACH_RATIO;
    const isSlaBreaching = isReceiveBreaching || isProcessBreaching;
    const baseItem = toListItem(row);
    const item = { ...baseItem, slaOverdue: computeSlaOverdue(baseItem, slaByBranch, slaFallback, now) };

    if (row.statusName === STATUS.WAITING && !isSlaBreaching) buckets.new_waiting.push(item);
    else if (isSlaBreaching) buckets.sla_breaching.push(item);
    else if (row.statusName === STATUS.PROCESSING) buckets.processing_no_phone.push(item);
  }

  const groups: LeadQueueGroup[] = QUEUE_ORDER.map((key) => ({
    key,
    label: QUEUE_GROUP_LABELS[key],
    items: buckets[key].slice(0, QUEUE_GROUP_CAP),
    total: buckets[key].length,
  }));

  return { groups, personalKpi };
}
