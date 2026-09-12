// Truy vấn đọc (list/queue/detail) cho Interaction — cặp đôi với mutations.ts
// (ghi). Tách riêng vì mutations.ts cần gọi getInteractionDetail() sau khi ghi
// xong trong cùng transaction, nên không thể đặt phần đọc lẫn trong 1 file
// import vòng lẫn nhau.
import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  CAN_CREATE_OR_EDIT_LEAD,
  CAN_PUSH_FOLLOWUP,
  CAN_REASSIGN,
  ROLES,
  STATUS,
  SYSTEM_LOG_ACTION,
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
 * hình ở /admin/branches (`Branch.slaReceiveMinutes`/`slaProcessHours`), thay
 * cho 1 mốc chung toàn hệ thống trước đây. Trả kèm 1 ngưỡng mặc định (30
 * phút/24 giờ) cho liên hệ không xác định được cơ sở. */
export async function getBranchSlaMap(): Promise<{ byCode: Map<string, BranchSla>; fallback: BranchSla }> {
  const branches = await prisma.branch.findMany({ select: { code: true, slaReceiveMinutes: true, slaProcessHours: true } });
  return {
    byCode: new Map(branches.map((b) => [b.code, { slaReceiveMinutes: b.slaReceiveMinutes, slaProcessHours: b.slaProcessHours }])),
    fallback: { slaReceiveMinutes: 30, slaProcessHours: 24 },
  };
}

/**
 * Phạm vi cơ sở actor được xem, dùng làm điều kiện WHERE cho list/queue —
 * mirror canAccessBranch/canViewLead (scope.ts) nhưng ở dạng gộp cho query
 * thay vì kiểm tra từng dòng.
 */
export function branchScopeWhere(actor: CurrentUser): Prisma.InteractionWhereInput {
  if (actor.role === ROLES.BOARD) return { assignedBranchCode: "__NONE__" }; // BGĐ không xem danh sách/queue lead
  if (isLeaderLike(actor)) return {};
  if (actor.role === ROLES.SALES) return { assignedBranchCode: actor.branchCode ?? "__NONE__" };
  if (actor.viewAllBranches) return {};
  return actor.branchCode ? { assignedBranchCode: actor.branchCode } : {};
}

/** Sale/Leader/Admin đang hoạt động — danh sách cho Leader/Admin chọn khi
 * điều chuyển người phụ trách (reassignInteraction). Chỉ Leader/Admin mới gọi
 * được (route tự kiểm tra CAN_REASSIGN), và cả 2 vai trò này đã thấy toàn bộ
 * chi nhánh (isLeaderLike ở scope.ts) nên không cần lọc theo cơ sở actor. */
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
  const canEditOrCreate = (CAN_CREATE_OR_EDIT_LEAD as readonly string[]).includes(actor.role);

  return {
    canEditInfo: isLeaderLike(actor) || (actor.role === ROLES.SALES && accessible && open),
    canUpdateStatus: canEditOrCreate && (isLeaderLike(actor) || (accessible && open)),
    canReassign: (CAN_REASSIGN as readonly string[]).includes(actor.role) && canonicalStatusKey(lead.statusName) === "PHONE",
    canRequestFollowup: (CAN_PUSH_FOLLOWUP as readonly string[]).includes(actor.role) && open && !lead.needsFollowup,
    canResolveFollowup: canEditOrCreate && accessible && lead.needsFollowup,
  };
}

export async function getInteractionDetail(actor: CurrentUser, interactionId: string, tx: Tx = prisma): Promise<InteractionDetail> {
  const row = await tx.interaction.findUnique({ where: { interactionId }, include: detailInclude });
  if (!row) throw Errors.notFound();
  if (!canViewLead(actor, row.assignedBranchCode)) throw Errors.forbidden("Bạn không được xem hội thoại này.");

  const [customerHistoryRows, touchLogs] = await Promise.all([
    tx.interaction.findMany({
      where: { customerKey: row.customerKey, interactionId: { not: interactionId } },
      include: listItemInclude,
      orderBy: { createdLeadAt: "desc" },
    }),
    tx.systemLog.findMany({
      where: { interactionId, action: SYSTEM_LOG_ACTION.TOUCH },
      orderBy: { loggedAt: "desc" },
      select: { loggedAt: true, actorName: true, actorEmail: true, detailNew: true },
    }),
  ]);

  return toDetail(row, {
    permissions: buildPermissions(actor, row),
    customerHistory: customerHistoryRows.map(toListItem),
    touchLog: touchLogs.map((l) => ({
      loggedAt: l.loggedAt.toISOString(),
      actorName: l.actorName,
      actorEmail: l.actorEmail,
      note: (l.detailNew as { note?: string | null } | null)?.note ?? null,
    })),
  });
}

export type ListInteractionsParams = {
  status?: string; // 1 giá trị, hoặc nhiều giá trị nối dấu phẩy
  needsFollowup?: boolean;
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
  const where: Prisma.InteractionWhereInput = { ...branchScopeWhere(actor), activeFlag: true };
  // "mine" và "search" đều cần diễn đạt bằng OR — không thể gán trực tiếp 2 lần
  // vào where.OR (key sau sẽ đè key trước), nên mỗi OR-block được gom vào đây
  // và kết hợp lại bằng AND ở cuối.
  const andConditions: Prisma.InteractionWhereInput[] = [];

  if (params.status) {
    const statuses = params.status.split(",").map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) where.statusName = statuses[0];
    else if (statuses.length > 1) where.statusName = { in: statuses };
  }
  if (params.needsFollowup) where.needsFollowup = true;
  if (params.mine) {
    // "Của tôi" = lead do actor tạo (Chờ/Tiếp nhận, chưa có assignedSaleEmail)
    // HOẶC lead đã Đủ tiêu chuẩn mà actor là người phụ trách chính thức —
    // chỉ lọc theo assignedSaleEmail sẽ luôn rỗng ở 2 tab đầu vì field đó chỉ
    // được gán từ lúc Đủ tiêu chuẩn trở đi (xem mutations.ts updateStatus).
    andConditions.push({ OR: [{ createdByEmail: actor.email }, { assignedSaleEmail: actor.email }] });
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

  const [totalItems, rows] = await Promise.all([
    prisma.interaction.count({ where }),
    prisma.interaction.findMany({
      where,
      include: listItemInclude,
      orderBy: { createdLeadAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toListItem),
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };
}

const QUEUE_GROUP_LABELS: Record<Exclude<LeadQueueGroup["key"], "recently_closed">, string> = {
  new_waiting: "Mới đang Chờ",
  sla_breaching: "Sắp/đã quá SLA",
  followup_requested: "Cần chăm sóc lại",
  processing_no_phone: "Tiếp nhận, chưa có SĐT",
};
const QUEUE_ORDER = ["new_waiting", "sla_breaching", "followup_requested", "processing_no_phone"] as const;
// Trần an toàn để tránh payload quá lớn — phân trang thật trong mỗi nhóm nằm
// ở client (leads-queue-view.tsx), vì việc gộp nhóm (loại trừ lẫn nhau, phụ
// thuộc SLA theo cơ sở) phải tính trên toàn bộ tập mở nên khó tách theo trang ở DB.
const QUEUE_GROUP_CAP = 200;
// "Sắp quá SLA" tính từ % thời gian mốc đã trôi qua, không chỉ khi đã breach hẳn.
const SLA_APPROACH_RATIO = 0.8;

function emptyPersonalKpi(): LeadQueue["personalKpi"] {
  return { totalToday: 0, waiting: 0, processing: 0, qualified: 0, spam: 0, qualifiedRate: null };
}

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
 * Hàng đợi ưu tiên: mới đang Chờ → sắp/đã quá SLA → cần chăm sóc lại → Tiếp
 * nhận chưa có SĐT (đúng thứ tự banner ở trang Liên hệ). Mỗi lead chỉ rơi vào
 * ĐÚNG 1 nhóm — nhóm đầu tiên khớp theo thứ tự trên thắng, để không hiển thị
 * trùng lặp giữa các nhóm.
 *
 * SLA tính theo TỪNG cơ sở (Branch.slaReceiveMinutes/slaProcessHours, sửa ở
 * /admin/branches) — không còn 1 mốc chung toàn hệ thống. "Chờ" quá
 * slaReceiveMinutes = chưa ai liên hệ kịp; "Tiếp nhận" quá slaProcessHours =
 * đã liên hệ nhưng xử lý (xin SĐT) quá lâu. Lưu ý: schema không có mốc "vào
 * Tiếp nhận" riêng, nên dùng createdLeadAt (giờ tạo lead) làm gốc đo cho cả 2
 * trạng thái — chấp nhận đây là ước lượng, không phải SLA xử lý tuyệt đối chính xác.
 */
export async function getQueue(actor: CurrentUser): Promise<LeadQueue> {
  if (actor.role === ROLES.BOARD) {
    return { groups: [], personalKpi: emptyPersonalKpi() };
  }

  const [{ byCode: slaByBranch, fallback: slaFallback }, openRows, personalKpi] = await Promise.all([
    getBranchSlaMap(),
    prisma.interaction.findMany({
      where: { ...branchScopeWhere(actor), activeFlag: true, statusName: { in: [STATUS.WAITING, STATUS.PROCESSING] } },
      include: listItemInclude,
      orderBy: { createdLeadAt: "asc" },
    }),
    computePersonalKpi(actor),
  ]);

  const now = Date.now();
  const buckets: Record<(typeof QUEUE_ORDER)[number], InteractionListItem[]> = {
    new_waiting: [],
    sla_breaching: [],
    followup_requested: [],
    processing_no_phone: [],
  };

  for (const row of openRows) {
    const sla = slaByBranch.get(row.assignedBranchCode) ?? slaFallback;
    const elapsedMinutes = (now - row.createdLeadAt.getTime()) / 60000;
    const isReceiveBreaching = row.statusName === STATUS.WAITING && elapsedMinutes >= sla.slaReceiveMinutes * SLA_APPROACH_RATIO;
    const isProcessBreaching = row.statusName === STATUS.PROCESSING && elapsedMinutes >= sla.slaProcessHours * 60 * SLA_APPROACH_RATIO;
    const isSlaBreaching = isReceiveBreaching || isProcessBreaching;
    const item = toListItem(row);

    if (row.statusName === STATUS.WAITING && !isSlaBreaching && !row.needsFollowup) buckets.new_waiting.push(item);
    else if (isSlaBreaching) buckets.sla_breaching.push(item);
    else if (row.needsFollowup) buckets.followup_requested.push(item);
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
