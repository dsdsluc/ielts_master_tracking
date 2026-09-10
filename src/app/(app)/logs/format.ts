export const LOG_ACTION_LABELS: Record<string, string> = {
  CREATE_CONVERSATION: "Tạo liên hệ",
  UPDATE_CONVERSATION_INFO: "Cập nhật thông tin liên hệ",
  TOUCH: "Ghi nhận đã liên hệ",
  UPDATE_RESULT: "Cập nhật kết quả",
  MKT_PUSH_SALE: "Marketing yêu cầu chăm sóc lại",
  MKT_PUSH_RESOLVED: "Đã xử lý chăm sóc lại",
  REASSIGN_PHONE_LEAD: "Chuyển tư vấn viên",
  CLOSE_MKT_PAGE_REPORT: "Chốt báo cáo Page",
  REOPEN_MKT_PAGE_REPORT: "Mở lại báo cáo Page",
  MERGE_CUSTOMERS: "Gộp khách hàng trùng",
  CLEANUP_SYSTEM_LOGS: "Dọn dẹp System Log",
  CLEANUP_ADS_COST: "Dọn dẹp chi phí quảng cáo",
  ADD_TO_WORKSPACE: "Thêm liên hệ vào Workspace",
  RELEASE_FROM_WORKSPACE: "Giải phóng liên hệ khỏi Workspace",
};

export function actionLabel(action: string) {
  return LOG_ACTION_LABELS[action] ?? action;
}

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
