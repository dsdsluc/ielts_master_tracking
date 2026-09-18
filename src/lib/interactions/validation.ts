import { z } from "zod";
import { EXTERNAL_LEAD_SOURCES, SETTABLE_STATUSES, SPAM_REASON_MIN_LENGTH, isValidSpamReason } from "@/lib/interactions/constants";

const noteSchema = z.string().trim().max(2000, "Ghi chú quá dài. Vui lòng rút gọn dưới 2.000 ký tự.");

export const leadInfoSchema = z.object({
  rawLink: z.string().trim().min(1, "Vui lòng nhập/chọn Link khách hàng."),
  customerName: z.string().trim().min(1, "Vui lòng nhập/chọn Tên khách hàng."),
  fanpageName: z.string().trim().min(1, "Vui lòng nhập/chọn Fanpage."),
  adId: z.string().trim().max(100, "Ad ID quá dài.").optional(),
  customerObjectName: z.string().trim().optional(),
  assignedBranchCode: z.string().trim().optional(),
  conversationLink: z.string().trim().optional(),
  // Nhập kèm SĐT (vd. từ Excel nhập liên hệ cũ) — có giá trị thì tạo thẳng ở
  // trạng thái "Đủ tiêu chuẩn" thay vì "Chờ". Xem createInteraction().
  phoneRaw: z.string().trim().optional(),
  duplicateConfirmed: z.boolean().optional(),
  duplicateReason: z.string().trim().optional(),
});
export type LeadInfoInput = z.infer<typeof leadInfoSchema>;

export const updateLeadInfoSchema = leadInfoSchema.extend({
  expectedVersion: z.number().int().min(1),
});
export type UpdateLeadInfoInput = z.infer<typeof updateLeadInfoSchema>;

// Tạo liên hệ mới có 2 luồng riêng (xem new-lead-dialog.tsx):
// - "facebook": y hệt leadInfoSchema hiện có (Link bắt buộc, SĐT tùy chọn).
// - "external": không có Link — Tên/Nguồn/SĐT/Cơ sở đều bắt buộc, Sale tự
//   chọn Nguồn (khác "facebook" luôn tự suy ra nguồn từ domain của Link).
// Chỉ áp dụng cho TẠO MỚI — sửa liên hệ (updateLeadInfoSchema) không đổi.
const facebookCreateLeadSchema = leadInfoSchema.extend({
  channel: z.literal("facebook"),
  // Nhập kèm mốc tư vấn (từ Excel đã có sẵn dữ liệu tư vấn cũ) — chỉ áp dụng
  // lúc TẠO MỚI và Đủ tiêu chuẩn (có SĐT), xem createInteraction().
  stage: z.string().trim().optional(),
  stageReason: z.string().trim().max(500).optional(),
});

const externalCreateLeadSchema = z.object({
  channel: z.literal("external"),
  customerName: z.string().trim().min(1, "Vui lòng nhập tên khách hàng."),
  sourceName: z.enum(EXTERNAL_LEAD_SOURCES),
  phoneRaw: z.string().trim().min(1, "Vui lòng nhập số điện thoại."),
  assignedBranchCode: z.string().trim().min(1, "Vui lòng chọn cơ sở."),
  customerObjectName: z.string().trim().optional(),
  duplicateConfirmed: z.boolean().optional(),
  duplicateReason: z.string().trim().optional(),
});

export const createLeadSchema = z.discriminatedUnion("channel", [facebookCreateLeadSchema, externalCreateLeadSchema]);
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type ExternalCreateLeadInput = Extract<CreateLeadInput, { channel: "external" }>;

export const listInteractionsQuerySchema = z.object({
  // "status" nhận 1 giá trị hoặc nhiều giá trị nối bằng dấu phẩy (vd. tab "Đã
  // đóng" cần gộp cả "Đủ tiêu chuẩn" và "Spam" trong 1 lần truy vấn phân trang).
  status: z.string().optional(),
  branch: z.string().optional(),
  assignedSaleEmail: z.string().optional(),
  mine: z.enum(["true", "false"]).optional(),
  search: z.string().trim().max(200, "Từ khoá tìm kiếm quá dài.").optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const statusUpdateSchema = z
  .object({
    status: z.enum(SETTABLE_STATUSES),
    phoneRaw: z.string().trim().optional(),
    // Nhập tay tự do (không còn ép đúng 1 trong 3 mã cố định) — UI chỉ gợi ý
    // nhanh bằng cách điền sẵn vào ô này, xem isValidSpamReason().
    spamReason: z.string().trim().max(500, "Lý do Spam quá dài.").optional(),
    confirmedMinAttempts: z.boolean().optional(),
    note: noteSchema.optional(),
    expectedVersion: z.number().int().min(1),
  })
  .refine((v) => v.status !== "Spam" || isValidSpamReason(v.spamReason), {
    message: `Vui lòng nhập lý do Spam (trên ${SPAM_REASON_MIN_LENGTH} ký tự).`,
    path: ["spamReason"],
  });
export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;

export const followupPushSchema = z.object({
  interactionIds: z.array(z.string().trim().min(1)).min(1, "Vui lòng chọn ít nhất một hội thoại Chờ hoặc Có nhu cầu.").max(50, "Mỗi lần chỉ được yêu cầu chăm sóc lại tối đa 50 hội thoại."),
  targetSaleEmail: z.string().trim().email("Vui lòng chọn Sale nhận yêu cầu chăm sóc lại."),
  suggestion: z.string().trim().max(500, "Gợi ý chăm sóc tối đa 500 ký tự.").optional(),
});

export const reassignSchema = z.object({
  targetEmail: z.string().trim().email("Email người phụ trách mới không hợp lệ."),
  reason: z.string().trim().min(1, "Vui lòng nhập lý do điều chỉnh."),
  expectedVersion: z.number().int().min(1),
});

export const bulkReassignSchema = z.object({
  items: z
    .array(z.object({ interactionId: z.string().trim().min(1), expectedVersion: z.number().int().min(1) }))
    .min(1, "Vui lòng chọn ít nhất một liên hệ.")
    .max(50, "Mỗi lần chỉ điều chuyển tối đa 50 liên hệ."),
  targetEmail: z.string().trim().email("Email người phụ trách mới không hợp lệ."),
  reason: z.string().trim().min(1, "Vui lòng nhập lý do điều chỉnh."),
});
