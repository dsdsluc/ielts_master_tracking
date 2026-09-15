import type { Prisma } from "@/generated/prisma/client";
import type { LeadStatus } from "@/lib/interactions/constants";
import type { InteractionDetail, InteractionListItem } from "@/lib/interactions/types";

export const listItemInclude = {
  assignedSale: { select: { fullName: true } },
  // Nhiều Sale có thể cùng claim 1 liên hệ vào Workspace của họ — lấy hết để
  // vừa xác định "tư vấn viên gần nhất thao tác" (claim đầu tiên sau khi sort
  // desc theo lastActivityAt), vừa biết đủ actor nào đang có mặt (dùng ở các
  // trang lọc "Workspace của tôi").
  workspaceClaims: {
    orderBy: { lastActivityAt: "desc" },
    include: { sale: { select: { fullName: true } } },
  },
} satisfies Prisma.InteractionInclude;

export const detailInclude = {
  ...listItemInclude,
  createdBy: { select: { fullName: true } },
  updatedBy: { select: { fullName: true } },
  reassignedBy: { select: { fullName: true } },
} satisfies Prisma.InteractionInclude;

type ListRow = Prisma.InteractionGetPayload<{ include: typeof listItemInclude }>;
type DetailRow = Prisma.InteractionGetPayload<{ include: typeof detailInclude }>;

export function toListItem(row: ListRow): InteractionListItem {
  // Đã sort desc theo lastActivityAt ở listItemInclude — phần tử đầu tiên là
  // người thao tác gần nhất, quyết định "Tư vấn viên" hiển thị khi liên hệ
  // chưa Đủ tiêu chuẩn (assignedSaleEmail còn null).
  const latestClaim = row.workspaceClaims[0];
  return {
    interactionId: row.interactionId,
    customerKey: row.customerKey,
    customerName: row.customerName,
    status: row.statusName as LeadStatus,
    sourceName: row.sourceName,
    fanpageName: row.fanpageName,
    adId: row.adId,
    assignedBranchCode: row.assignedBranchCode,
    assignedSaleEmail: row.assignedSaleEmail,
    assignedSaleName: row.assignedSale?.fullName ?? null,
    workspaceClaimantEmails: row.workspaceClaims.map((c) => c.saleEmail),
    consultantEmail: row.assignedSaleEmail ?? latestClaim?.saleEmail ?? null,
    consultantName: row.assignedSale?.fullName ?? latestClaim?.sale.fullName ?? null,
    createdByEmail: row.createdByEmail,
    createdLeadAt: row.createdLeadAt.toISOString(),
    touchCount: row.touchCount,
    needsFollowup: row.needsFollowup,
    phoneNormalized: row.phoneNormalized,
    conversationLink: row.conversationLink,
    version: row.version,
    // Người gọi có ngữ cảnh SLA (branch SLA map) mới tính lại field này —
    // xem computeSlaOverdue() trong queries.ts.
    slaOverdue: false,
  };
}

export function toDetail(
  row: DetailRow,
  extra: {
    permissions: InteractionDetail["permissions"];
    customerHistory: InteractionListItem[];
    touchLog: InteractionDetail["touchLog"];
    emailMessages: InteractionDetail["emailMessages"];
  }
): InteractionDetail {
  return {
    ...toListItem(row),
    rawLink: row.rawLink,
    canonicalLink: row.canonicalLink,
    customerObjectName: row.customerObjectName,
    suggestedBranchCode: row.suggestedBranchCode,
    interactionType: row.interactionType,
    phoneRaw: row.phoneRaw,
    phoneCapturedAt: row.phoneCapturedAt?.toISOString() ?? null,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    createdByName: row.createdBy?.fullName ?? row.createdByEmail,
    createdAt: row.createdAt.toISOString(),
    updatedByName: row.updatedBy?.fullName ?? row.updatedByEmail ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    reassignedByName: row.reassignedBy?.fullName ?? null,
    reassignReason: row.reassignReason,
    mktSuggestion: row.mktSuggestion,
    mktPushedAt: row.mktPushedAt?.toISOString() ?? null,
    followupHandledAt: row.followupHandledAt?.toISOString() ?? null,
    ...extra,
  };
}
