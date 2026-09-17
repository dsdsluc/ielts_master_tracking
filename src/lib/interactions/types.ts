import type { LeadStatus, SpamReason } from "@/lib/interactions/constants";

export type { LeadStatus, SpamReason };

export type InteractionListItem = {
  interactionId: string;
  // null khi liên hệ chưa Đủ tiêu chuẩn (chưa có SĐT) — chưa có dòng Customer.
  customerKey: string | null;
  customerName: string;
  status: LeadStatus;
  sourceName: string;
  fanpageName: string;
  adId: string | null;
  assignedBranchCode: string;
  assignedSaleEmail: string | null;
  assignedSaleName: string | null;
  // Một nguồn sự thật duy nhất cho "Tư vấn viên" và Workspace cá nhân.
  consultantEmail: string | null;
  consultantName: string | null;
  createdByEmail: string;
  createdLeadAt: string; // ISO
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
  // Nhật ký ghi đè từng field khi Sửa thông tin (chỉ field TỪNG có giá trị bị
  // ghi đè — điền lần đầu vào field trống không tính) — xem
  // InteractionFieldLog trong schema.prisma và updateInteractionInfo() trong
  // mutations.ts.
  fieldChangeLog: Array<{ fieldLabel: string; oldValue: string | null; newValue: string | null; changedByName: string; changedAt: string }>;
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
