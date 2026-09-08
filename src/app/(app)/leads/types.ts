// DTO khớp contract REST /api/interactions/* — re-export từ lib/interactions
// (nguồn sự thật duy nhất, dùng chung với route handler phía server) kèm vài
// type chỉ dùng ở client (ApiError, DuplicateConflict, danh sách lý do Spam).
import { SPAM_REASON } from "@/lib/interactions/constants";
import type { InteractionListItem } from "@/lib/interactions/types";

export type {
  LeadStatus,
  SpamReason,
  InteractionListItem,
  InteractionDetail,
  LeadQueueGroup as QueueGroup,
  LeadQueue as QueueResponse,
} from "@/lib/interactions/types";

export type ApiError = { error: string; code?: string };

export type DuplicateConflict = {
  duplicate: {
    interactionId: string;
    customerName: string;
    createdLeadAt: string;
    assignedSaleName: string | null;
  };
};

export type PagedInteractions = {
  items: InteractionListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

// Nhãn tiếng Việt hiển thị cho Sale <-> mã lưu DB (statusUpdateSchema chỉ
// chấp nhận đúng 3 mã này — xem SPAM_REASON trong lib/interactions/constants).
export const SPAM_REASON_OPTIONS = [
  { code: SPAM_REASON.NO_REPLY, label: "Khách im lặng (đủ số lần chăm sóc theo cấu hình)" },
  { code: SPAM_REASON.NO_NEED, label: "Khách xác nhận không có nhu cầu" },
  { code: SPAM_REASON.JUNK, label: "Tin nhắn/tài khoản rác" },
] as const;

export const SILENCE_REASON_CODE = SPAM_REASON.NO_REPLY;
