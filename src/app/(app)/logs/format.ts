export const LOG_ACTION_LABELS: Record<string, string> = {
  CREATE_CONVERSATION: "Tạo liên hệ",
  UPDATE_CONVERSATION_INFO: "Cập nhật thông tin liên hệ",
  TOUCH: "Ghi nhận đã liên hệ",
  UPDATE_RESULT: "Cập nhật kết quả",
  MKT_PUSH_SALE: "Gửi yêu cầu chăm sóc lại",
  MKT_PUSH_RESOLVED: "Đã xử lý chăm sóc lại",
  FOLLOWUP_ASSIGN: "Phân bổ chăm sóc lại",
  REASSIGN_PHONE_LEAD: "Chuyển tư vấn viên",
  CLOSE_MKT_PAGE_REPORT: "Chốt báo cáo Page",
  REOPEN_MKT_PAGE_REPORT: "Mở lại báo cáo Page",
  MERGE_CUSTOMERS: "Gộp khách hàng trùng",
  ADD_TO_WORKSPACE: "Thêm liên hệ vào Workspace",
  RELEASE_FROM_WORKSPACE: "Giải phóng liên hệ khỏi Workspace",
  FLAG_SLA_BREACH: "Đánh dấu quá SLA",
  SEND_BROADCAST_EMAIL: "Gửi email cho thành viên",
  ASSIGN_STUDENT: "Phân bổ học viên",
  UPDATE_STUDENT_STAGE: "Cập nhật tiến trình tư vấn học viên",
  TRANSFER_STUDENT: "Chuyển giao học viên",
};

export function actionLabel(action: string) {
  return LOG_ACTION_LABELS[action] ?? action;
}

// Hành động dọn dẹp dữ liệu hệ thống (Admin) — không phải việc nhân viên làm
// với khách/học viên, nên trang Nhật ký hoạt động không liệt kê các dòng này.
export const ADMIN_ONLY_ACTIONS = ["CLEANUP_SYSTEM_LOGS", "CLEANUP_ADS_COST"];

export type LogCategoryKey = "lead" | "followup" | "student" | "sla";

// Gộp hành động thành 4 nhóm nghiệp vụ — dùng để tô màu phân biệt trong
// feed và lọc theo nhóm thay vì phải nhớ tên từng hành động lẻ.
export const ACTION_CATEGORY: Record<string, LogCategoryKey> = {
  CREATE_CONVERSATION: "lead",
  UPDATE_CONVERSATION_INFO: "lead",
  TOUCH: "lead",
  UPDATE_RESULT: "lead",
  REASSIGN_PHONE_LEAD: "lead",
  MERGE_CUSTOMERS: "lead",
  ADD_TO_WORKSPACE: "lead",
  RELEASE_FROM_WORKSPACE: "lead",
  MKT_PUSH_SALE: "followup",
  MKT_PUSH_RESOLVED: "followup",
  FOLLOWUP_ASSIGN: "followup",
  CLOSE_MKT_PAGE_REPORT: "followup",
  REOPEN_MKT_PAGE_REPORT: "followup",
  SEND_BROADCAST_EMAIL: "followup",
  ASSIGN_STUDENT: "student",
  UPDATE_STUDENT_STAGE: "student",
  TRANSFER_STUDENT: "student",
  FLAG_SLA_BREACH: "sla",
};

export function actionCategory(action: string): LogCategoryKey | null {
  return ACTION_CATEGORY[action] ?? null;
}

export const LOG_CATEGORY_META: Record<LogCategoryKey, { label: string; bgClass: string; textClass: string }> = {
  lead: { label: "Liên hệ & khách hàng", bgClass: "bg-status-received-bg", textClass: "text-status-received" },
  followup: { label: "Chăm sóc lại & Marketing", bgClass: "bg-accent", textClass: "text-gold" },
  student: { label: "Học viên", bgClass: "bg-status-qualified-bg", textClass: "text-status-qualified" },
  sla: { label: "Giám sát SLA", bgClass: "bg-status-spam-bg", textClass: "text-status-spam" },
};

export const LOG_CATEGORY_OPTIONS: { value: LogCategoryKey; label: string }[] = (
  Object.entries(LOG_CATEGORY_META) as [LogCategoryKey, (typeof LOG_CATEGORY_META)[LogCategoryKey]][]
).map(([value, meta]) => ({ value, label: meta.label }));

export const LOG_RESULT_LABELS: Record<string, string> = {
  SUCCESS: "Thành công",
  FAIL: "Thất bại",
};

export function resultLabel(result: string) {
  return LOG_RESULT_LABELS[result] ?? result;
}

const FIELD_LABELS: Record<string, string> = {
  interactionType: "Loại tương tác",
  canonicalLink: "Link chuẩn",
  customerName: "Tên khách",
  note: "Ghi chú",
  status: "Trạng thái",
  spamReason: "Lý do spam",
  pushedBy: "Người gửi yêu cầu",
  suggestion: "Gợi ý",
  pushedAt: "Thời điểm gửi yêu cầu",
  resolvedAt: "Thời điểm xử lý",
  resolvedByEmail: "Người xử lý",
  assignedSaleEmail: "Tư vấn viên",
};

export function fieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "string") {
    if (ISO_DATE_RE.test(value)) {
      return new Date(value).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return value || "—";
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export type DetailDiffRow = {
  key: string;
  hasBefore: boolean;
  hasAfter: boolean;
  before: unknown;
  after: unknown;
};

/** Gộp detailOld/detailNew (2 JSON object rời) thành các dòng theo field để hiển thị
 * dạng bảng — mỗi action ghi field khác nhau, không phải lúc nào cũng là "before/after"
 * của cùng 1 field, nên field chỉ có ở 1 bên vẫn hiển thị được, phía kia để trống. */
export function buildDetailDiffRows(before: unknown, after: unknown): DetailDiffRow[] | null {
  const beforeObj = before && typeof before === "object" && !Array.isArray(before) ? (before as Record<string, unknown>) : null;
  const afterObj = after && typeof after === "object" && !Array.isArray(after) ? (after as Record<string, unknown>) : null;
  if (!beforeObj && !afterObj) return null;

  const keys = Array.from(new Set([...(beforeObj ? Object.keys(beforeObj) : []), ...(afterObj ? Object.keys(afterObj) : [])]));
  return keys.map((key) => ({
    key,
    hasBefore: !!beforeObj && Object.hasOwn(beforeObj, key),
    hasAfter: !!afterObj && Object.hasOwn(afterObj, key),
    before: beforeObj?.[key],
    after: afterObj?.[key],
  }));
}
