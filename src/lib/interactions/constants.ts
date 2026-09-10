// Hằng số nghiệp vụ — port 1:1 từ đối tượng TL trong docs/TRACKING_LEADS/Backend.js
// (Apps Script gốc), giữ nguyên tên trạng thái/vai trò tiếng Việt vì đây là
// giá trị lưu thẳng trong DB (Status.name, User.role).

export const ROLES = {
  MARKETING: "Marketing",
  SALES: "Sale/Admin",
  LEADER: "Leader",
  BOARD: "BGĐ",
  ADMIN: "Quản trị hệ thống",
} as const;

export const STATUS = {
  WAITING: "Chờ",
  PROCESSING: "Tiếp nhận",
  PHONE: "Đủ tiêu chuẩn",
  SPAM: "Spam",
} as const;

export type LeadStatus = (typeof STATUS)[keyof typeof STATUS];

// Trạng thái hoạt động (4 nhóm) mà API cho phép set qua /status. "Chờ" chỉ do
// hệ thống gán lúc tạo — Sale không được tự chuyển về lại Chờ (theo workflow
// mới), nên KHÔNG có trong tập giá trị hợp lệ của body { status }.
export const SETTABLE_STATUSES = [STATUS.PROCESSING, STATUS.PHONE, STATUS.SPAM] as const;

export type StatusKey = "WAITING" | "PROCESSING" | "PHONE" | "SPAM" | "OTHER";

// Dùng ở cả mutations.ts (kiểm tra quyền sửa) và queries.ts (tính quyền xem/sửa
// trả về cho client) — tách riêng để 2 file đó không phải import lẫn nhau.
export function canonicalStatusKey(status: string): StatusKey {
  if (status === STATUS.WAITING) return "WAITING";
  if (status === STATUS.PROCESSING) return "PROCESSING";
  if (status === STATUS.PHONE) return "PHONE";
  if (status === STATUS.SPAM) return "SPAM";
  return "OTHER";
}

export function isOpenStatus(status: string): boolean {
  const key = canonicalStatusKey(status);
  return key === "WAITING" || key === "PROCESSING";
}

export const SPAM_REASON = {
  NO_REPLY: "NO_REPLY_AFTER_MIN_ATTEMPTS",
  NO_NEED: "CUSTOMER_CONFIRMED_NO_NEED",
  JUNK: "JUNK_OR_FAKE_ACCOUNT",
  // Hệ thống tự gắn khi resolveFollowup() vượt ngưỡng MAX_FOLLOWUP_BEFORE_SPAM
  // — không xuất hiện trong danh sách lý do Sale tự chọn ở SpamDialog.
  MAX_FOLLOWUP_EXCEEDED: "MAX_FOLLOWUP_ATTEMPTS_EXCEEDED",
} as const;

export type SpamReason = (typeof SPAM_REASON)[keyof typeof SPAM_REASON];

export const INTERACTION_TYPE = {
  NEW: "Khách hàng mới",
  REMARKETING: "Remarketing/đa điểm chạm",
  REPEAT: "Tương tác lặp",
  SUSPECT_DUP: "Nghi trùng 24h",
} as const;

// Kết quả xử lý yêu cầu "Chăm sóc lại" — dùng để tách "chăm sóc thật" (có đổi
// trạng thái) khỏi "bấm cho xong" (đóng thủ công không kèm hành động).
export const FOLLOWUP_OUTCOME = {
  STATUS_CHANGED: "STATUS_CHANGED",
  MANUAL_DISMISS: "MANUAL_DISMISS",
} as const;

export type FollowupOutcome = (typeof FOLLOWUP_OUTCOME)[keyof typeof FOLLOWUP_OUTCOME];

export const SYSTEM_LOG_ACTION = {
  CREATE_CONVERSATION: "CREATE_CONVERSATION",
  UPDATE_CONVERSATION_INFO: "UPDATE_CONVERSATION_INFO",
  TOUCH: "TOUCH",
  UPDATE_RESULT: "UPDATE_RESULT",
  MKT_PUSH: "MKT_PUSH_SALE",
  MKT_PUSH_RESOLVED: "MKT_PUSH_RESOLVED",
  REASSIGN_PHONE_LEAD: "REASSIGN_PHONE_LEAD",
  CLOSE_MKT_PAGE_REPORT: "CLOSE_MKT_PAGE_REPORT",
  REOPEN_MKT_PAGE_REPORT: "REOPEN_MKT_PAGE_REPORT",
  MERGE_CUSTOMERS: "MERGE_CUSTOMERS",
  CLEANUP_SYSTEM_LOGS: "CLEANUP_SYSTEM_LOGS",
  CLEANUP_ADS_COST: "CLEANUP_ADS_COST",
  ADD_TO_WORKSPACE: "ADD_TO_WORKSPACE",
  RELEASE_FROM_WORKSPACE: "RELEASE_FROM_WORKSPACE",
  FLAG_SLA_BREACH: "FLAG_SLA_BREACH",
} as const;

// Vai trò được phép thao tác — mirror requireRole_([...]) ở từng hàm gốc.
export const CAN_CREATE_OR_EDIT_LEAD = [ROLES.SALES, ROLES.LEADER, ROLES.ADMIN] as const;
export const CAN_PUSH_FOLLOWUP = [ROLES.MARKETING, ROLES.LEADER, ROLES.ADMIN] as const;
export const CAN_REASSIGN = [ROLES.LEADER, ROLES.ADMIN] as const;
export const IS_LEADER_LIKE = [ROLES.LEADER, ROLES.ADMIN] as const;
// BGĐ chỉ xem báo cáo tổng hợp (xem canViewLead trong scope.ts) — không có mặt ở đây.
export const CAN_VIEW_LEAD = [ROLES.SALES, ROLES.LEADER, ROLES.MARKETING, ROLES.ADMIN] as const;
