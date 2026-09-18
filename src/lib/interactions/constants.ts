// Hằng số nghiệp vụ — port 1:1 từ đối tượng TL trong docs/TRACKING_LEADS/Backend.js
// (Apps Script gốc), giữ nguyên tên trạng thái/vai trò tiếng Việt vì đây là
// giá trị lưu thẳng trong DB (Status.name, User.role).

export const ROLES = {
  MARKETING: "Marketing",
  SALES: "Saler",
  LEADER: "Leader",
  ADMIN: "Admin",
} as const;

// PROCESSING = "Có nhu cầu" — Sale ĐÃ nhắn tin qua lại thật với khách (không
// chỉ vì có sẵn link cuộc hội thoại) nhưng CHƯA xin được SĐT. Tên cũ "Tiếp
// nhận" gây hiểu lầm là 1 bước tự động ngay khi có link hội thoại — SAI, đây
// luôn là hành động CHỦ ĐỘNG của Sale (xem resolveFollowup()/"Ghi nhận đã
// liên hệ" trong mutations.ts), không tự suy ra từ dữ liệu có sẵn.
export const STATUS = {
  WAITING: "Chờ",
  PROCESSING: "Có nhu cầu",
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

// Lý do Spam giờ cho nhập tay tự do thay vì ép chọn đúng 1 trong 3 mã cố định
// — SPAM_REASON/SPAM_REASON_OPTIONS (leads/types.ts) chỉ còn vai trò GỢI Ý
// NHANH (điền sẵn vào ô nhập) và hiển thị đúng nhãn cho dữ liệu cũ đã lưu
// bằng mã. Chỉ ràng buộc độ dài tối thiểu để tránh gõ bừa cho có (vd. "ok").
export const SPAM_REASON_MIN_LENGTH = 5;

export function isValidSpamReason(value: string | null | undefined): boolean {
  return !!value && value.trim().length > SPAM_REASON_MIN_LENGTH;
}

export const INTERACTION_TYPE = {
  NEW: "Khách hàng mới",
  REMARKETING: "Remarketing/đa điểm chạm",
  REPEAT: "Tương tác lặp",
  SUSPECT_DUP: "Nghi trùng 24h",
} as const;

// Tab "Ngoài" ở form tạo liên hệ (không qua Link) — Nguồn Sale tự chọn (khác
// tab Facebook, nguồn luôn tự suy ra từ domain của Link). Fanpage placeholder
// dùng chung cho mọi liên hệ tạo từ tab này — chỉ để thỏa khóa ngoại bắt buộc
// của Interaction.fanpageName, KHÔNG đại diện cho 1 fanpage thật (xem
// resolveExternalLeadInfo() trong lead-info.ts, migration 20260916030000).
export const EXTERNAL_LEAD_SOURCES = ["Zalo", "TikTok", "Giới thiệu", "Khác"] as const;
export const EXTERNAL_LEAD_FANPAGE = "Ngoài kênh online";

// Kết quả xử lý yêu cầu "Chăm sóc lại" — dùng để tách "chăm sóc thật" (có đổi
// trạng thái) khỏi "bấm cho xong" (đóng thủ công không kèm hành động).
export const FOLLOWUP_OUTCOME = {
  STATUS_CHANGED: "STATUS_CHANGED",
  MANUAL_DISMISS: "MANUAL_DISMISS",
} as const;

export type FollowupOutcome = (typeof FOLLOWUP_OUTCOME)[keyof typeof FOLLOWUP_OUTCOME];

// Mã hành động dùng cho InteractionFieldLog (interaction_field_logs) khi dòng
// đó KHÔNG phải sửa 1 field cụ thể — đặt trong đúng `fieldKey`, `fieldLabel`
// tương ứng là nhãn hiển thị. Đây là "lịch sử của 1 liên hệ" (hiện trên trang
// chi tiết của nó), khác với SYSTEM_LOG_ACTION (nhật ký audit toàn hệ thống ở
// /logs) — 2 bảng phục vụ 2 mục đích khác nhau, không thay thế nhau.
export const INTERACTION_ACTIVITY = {
  TOUCH: "TOUCH",
  STATUS_CHANGE: "STATUS_CHANGE",
  FOLLOWUP_PUSH: "FOLLOWUP_PUSH",
  FOLLOWUP_ASSIGN: "FOLLOWUP_ASSIGN",
  FOLLOWUP_RESOLVED: "FOLLOWUP_RESOLVED",
  REASSIGN: "REASSIGN",
  SPAM_RESTORE: "SPAM_RESTORE",
} as const;

export const INTERACTION_ACTIVITY_LABEL: Record<(typeof INTERACTION_ACTIVITY)[keyof typeof INTERACTION_ACTIVITY], string> = {
  TOUCH: "Chăm sóc",
  STATUS_CHANGE: "Đổi trạng thái",
  FOLLOWUP_PUSH: "Marketing gửi yêu cầu chăm sóc lại",
  FOLLOWUP_ASSIGN: "Leader phân bổ yêu cầu cho Sale",
  FOLLOWUP_RESOLVED: "Sale đánh dấu đã chăm sóc lại",
  REASSIGN: "Điều chuyển người phụ trách",
  SPAM_RESTORE: "Admin khôi phục từ Spam, gửi chăm sóc lại",
};

export const SYSTEM_LOG_ACTION = {
  CREATE_CONVERSATION: "CREATE_CONVERSATION",
  UPDATE_CONVERSATION_INFO: "UPDATE_CONVERSATION_INFO",
  TOUCH: "TOUCH",
  UPDATE_RESULT: "UPDATE_RESULT",
  MKT_PUSH: "MKT_PUSH_SALE",
  MKT_PUSH_RESOLVED: "MKT_PUSH_RESOLVED",
  FOLLOWUP_ASSIGN: "FOLLOWUP_ASSIGN",
  REASSIGN_PHONE_LEAD: "REASSIGN_PHONE_LEAD",
  CLOSE_MKT_PAGE_REPORT: "CLOSE_MKT_PAGE_REPORT",
  REOPEN_MKT_PAGE_REPORT: "REOPEN_MKT_PAGE_REPORT",
  MERGE_CUSTOMERS: "MERGE_CUSTOMERS",
  CLEANUP_SYSTEM_LOGS: "CLEANUP_SYSTEM_LOGS",
  CLEANUP_ADS_COST: "CLEANUP_ADS_COST",
  ADD_TO_WORKSPACE: "ADD_TO_WORKSPACE",
  RELEASE_FROM_WORKSPACE: "RELEASE_FROM_WORKSPACE",
  FLAG_SLA_BREACH: "FLAG_SLA_BREACH",
  SEND_BROADCAST_EMAIL: "SEND_BROADCAST_EMAIL",
  ASSIGN_STUDENT: "ASSIGN_STUDENT",
  UPDATE_STUDENT_STAGE: "UPDATE_STUDENT_STAGE",
  TRANSFER_STUDENT: "TRANSFER_STUDENT",
  ASSIGN_CUSTOMER: "ASSIGN_CUSTOMER",
  UPDATE_CUSTOMER_PROFILE: "UPDATE_CUSTOMER_PROFILE",
  UPDATE_CUSTOMER_STAGE: "UPDATE_CUSTOMER_STAGE",
  LOG_CUSTOMER_CARE: "LOG_CUSTOMER_CARE",
  TRANSFER_CUSTOMER: "TRANSFER_CUSTOMER",
  RECLAIM_CUSTOMER: "RECLAIM_CUSTOMER",
  RESTORE_SPAM_TO_FOLLOWUP: "RESTORE_SPAM_TO_FOLLOWUP",
  DELETE_SPAM_INTERACTION: "DELETE_SPAM_INTERACTION",
  // Email chủ động (không do ai bấm gửi) — xem notifyLeadersNewQualifiedLead()/
  // notifyMarketingLeadSpammed() (lib/interactions/mutations.ts) và 2 route
  // /api/cron/* cho KPI/SLA. Tách hẳn khỏi UPDATE_RESULT/FLAG_SLA_BREACH vì
  // đây là tag của EMAIL gửi ra, không phải hành động nghiệp vụ đã xảy ra.
  NOTIFY_NEW_QUALIFIED_LEAD: "NOTIFY_NEW_QUALIFIED_LEAD",
  NOTIFY_LEAD_SPAMMED: "NOTIFY_LEAD_SPAMMED",
  KPI_REMINDER: "KPI_REMINDER",
  SLA_BREACH_DIGEST: "SLA_BREACH_DIGEST",
  ALLOCATION_SUGGESTION_DIGEST: "ALLOCATION_SUGGESTION_DIGEST",
} as const;

// Phễu tư vấn ghi danh (mốc xa nhất Sale đã đạt được với 1 Customer). null
// (chưa gán giá trị) = chưa gọi lần nào. Không có "trạng thái rớt" riêng —
// dùng Customer.stageReason để giải thích vì sao đang dừng ở 1 mốc bất kỳ.
export const CUSTOMER_STAGE = {
  CALLED: "Đã gọi",
  INTERESTED: "Quan tâm",
  NOT_INTERESTED: "Không quan tâm",
  TEST_SCHEDULED: "Đặt lịch test",
  TESTED: "Đã test",
  TRIAL_SCHEDULED: "Đặt lịch học thử",
  TRIALED: "Đã học thử",
  ENROLLED: "Đã chốt",
} as const;

export const CUSTOMER_STAGE_VALUES = Object.values(CUSTOMER_STAGE);
export type CustomerStage = (typeof CUSTOMER_STAGE)[keyof typeof CUSTOMER_STAGE];

