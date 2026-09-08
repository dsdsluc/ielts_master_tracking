import type { Prisma } from "@/generated/prisma/client";
import type { LeadStatus } from "@/lib/interactions/constants";
import type { InteractionDetail, InteractionListItem } from "@/lib/interactions/types";

export const listItemInclude = {
  assignedSale: { select: { fullName: true } },
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
    createdByEmail: row.createdByEmail,
    createdLeadAt: row.createdLeadAt.toISOString(),
    touchCount: row.touchCount,
    needsFollowup: row.needsFollowup,
    phoneNormalized: row.phoneNormalized,
    conversationLink: row.conversationLink,
    version: row.version,
  };
}

export function toDetail(
  row: DetailRow,
  extra: {
    permissions: InteractionDetail["permissions"];
    customerHistory: InteractionListItem[];
    touchLog: InteractionDetail["touchLog"];
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
