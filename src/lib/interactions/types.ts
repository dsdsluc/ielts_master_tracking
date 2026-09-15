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
  // Email của MỌI Sale đang có liên hệ này trong Workspace của họ — nhiều Sale
  // có thể cùng claim 1 liên hệ (không còn độc quyền). Dùng để lọc "liên hệ
  // của tôi" ở dashboard/Workspace mà không cần round-trip DB riêng.
  workspaceClaimantEmails: string[];
  // "Tư vấn viên" hiển thị cho người dùng: assignedSaleEmail chỉ có giá trị
  // từ khi Đủ tiêu chuẩn (SĐT), nên trước đó lấy theo Sale claim liên hệ vào
  // Workspace của họ GẦN NHẤT (lastActivityAt lớn nhất) — xem
  // autoClaimWorkspace() trong mutations.ts và listItemInclude trong serialize.ts.
  consultantEmail: string | null;
  consultantName: string | null;
  createdByEmail: string;
  createdLeadAt: string; // ISO
  touchCount: number;
  needsFollowup: boolean;
  phoneNormalized: string | null;
  conversationLink: string | null;
  version: number;
  // Đang "Chờ" và đã quá "SLA nhận" của cơ sở phụ trách — cùng ngưỡng với
  // trang /sla-queue ("Liên hệ chờ phản hồi quá lâu"), xem computeSlaOverdue().
  slaOverdue: boolean;
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
  // Lịch sử email hệ thống đã gửi có nhắc tới liên hệ này (phân bổ chăm sóc
  // lại...) — ai xem được liên hệ này cũng xem được, không chỉ người gửi/nhận.
  emailMessages: Array<{
    id: string;
    subject: string;
    html: string;
    toEmail: string;
    bccEmails: string[];
    action: string;
    sentAt: string;
    sentByName: string | null;
  }>;
};

export type LeadQueueGroup = {
  key: "new_waiting" | "sla_breaching" | "processing_no_phone" | "recently_closed";
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
