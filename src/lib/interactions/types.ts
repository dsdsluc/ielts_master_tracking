import type { LeadStatus, SpamReason } from "@/lib/interactions/constants";

export type { LeadStatus, SpamReason };

export type InteractionListItem = {
  interactionId: string;
  customerKey: string;
  customerName: string;
  status: LeadStatus;
  sourceName: string;
  fanpageName: string;
  adId: string | null;
  assignedBranchCode: string;
  assignedSaleEmail: string | null;
  assignedSaleName: string | null;
  workspaceClaimedByEmail: string | null;
  workspaceClaimedByName: string | null;
  // "Tư vấn viên" hiển thị cho người dùng: assignedSaleEmail chỉ có giá trị
  // từ khi Đủ tiêu chuẩn (SĐT), nên trước đó lấy theo người đang claim liên
  // hệ vào Workspace của họ — xem autoClaimWorkspace() trong mutations.ts.
  consultantEmail: string | null;
  consultantName: string | null;
  createdByEmail: string;
  createdLeadAt: string; // ISO
  touchCount: number;
  needsFollowup: boolean;
  phoneNormalized: string | null;
  conversationLink: string | null;
  version: number;
};

export type InteractionDetail = InteractionListItem & {
  rawLink: string;
  canonicalLink: string;
  customerObjectName: string;
  suggestedBranchCode: string;
  interactionType: string;
  phoneRaw: string | null;
  phoneCapturedAt: string | null;
  receivedAt: string | null;
  closedAt: string | null;
  createdByName: string;
  createdAt: string;
  updatedByName: string | null;
  updatedAt: string | null;
  reassignedByName: string | null;
  reassignReason: string | null;
  mktSuggestion: string | null;
  mktPushedAt: string | null;
  followupHandledAt: string | null;
  permissions: {
    canEditInfo: boolean;
    canUpdateStatus: boolean;
    canReassign: boolean;
    canRequestFollowup: boolean;
    canResolveFollowup: boolean;
  };
  customerHistory: InteractionListItem[];
  touchLog: Array<{ loggedAt: string; actorName: string; actorEmail: string | null; note: string | null }>;
};

export type LeadQueueGroup = {
  key: "new_waiting" | "sla_breaching" | "followup_requested" | "processing_no_phone" | "recently_closed";
  label: string;
  items: InteractionListItem[];
  total: number;
};

export type LeadQueue = {
  groups: LeadQueueGroup[];
  personalKpi: {
    totalToday: number;
    waiting: number;
    processing: number;
    qualified: number;
    spam: number;
    qualifiedRate: number | null;
  };
};
