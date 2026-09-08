import { z } from "zod";
import { SETTABLE_STATUSES, SPAM_REASON } from "@/lib/interactions/constants";

const noteSchema = z.string().trim().max(2000, "Ghi chú quá dài. Vui lòng rút gọn dưới 2.000 ký tự.");

export const leadInfoSchema = z.object({
  rawLink: z.string().trim().min(1, "Vui lòng nhập/chọn Link khách hàng."),
  customerName: z.string().trim().min(1, "Vui lòng nhập/chọn Tên khách hàng."),
  fanpageName: z.string().trim().min(1, "Vui lòng nhập/chọn Fanpage."),
  adId: z.string().trim().max(100, "Ad ID quá dài.").optional(),
  customerObjectName: z.string().trim().optional(),
  assignedBranchCode: z.string().trim().optional(),
  conversationLink: z.string().trim().optional(),
  duplicateConfirmed: z.boolean().optional(),
  duplicateReason: z.string().trim().optional(),
});
export type LeadInfoInput = z.infer<typeof leadInfoSchema>;

export const updateLeadInfoSchema = leadInfoSchema.extend({
  expectedVersion: z.number().int().min(1),
});
export type UpdateLeadInfoInput = z.infer<typeof updateLeadInfoSchema>;

export const listInteractionsQuerySchema = z.object({
  // "status" nhận 1 giá trị hoặc nhiều giá trị nối bằng dấu phẩy (vd. tab "Đã
  // đóng" cần gộp cả "Đủ tiêu chuẩn" và "Spam" trong 1 lần truy vấn phân trang).
  status: z.string().optional(),
  branch: z.string().optional(),
  assignedSaleEmail: z.string().optional(),
  needsFollowup: z.enum(["true", "false"]).optional(),
  mine: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const touchSchema = z.object({
  note: noteSchema.optional(),
});

export const statusUpdateSchema = z
  .object({
    status: z.enum(SETTABLE_STATUSES),
    phoneRaw: z.string().trim().optional(),
    spamReason: z.enum([SPAM_REASON.NO_REPLY, SPAM_REASON.NO_NEED, SPAM_REASON.JUNK]).optional(),
    confirmedMinAttempts: z.boolean().optional(),
    note: noteSchema.optional(),
    expectedVersion: z.number().int().min(1),
  })
  .refine((v) => v.status !== "Spam" || !!v.spamReason, {
    message: "Vui lòng chọn lý do Spam.",
    path: ["spamReason"],
  });
export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;

export const followupPushSchema = z.object({
  interactionIds: z.array(z.string().trim().min(1)).min(1, "Vui lòng chọn ít nhất một hội thoại Chờ hoặc Tiếp nhận.").max(50, "Mỗi lần chỉ được yêu cầu chăm sóc lại tối đa 50 hội thoại."),
  suggestion: z.string().trim().max(500, "Gợi ý chăm sóc tối đa 500 ký tự.").optional(),
});

export const reassignSchema = z.object({
  targetEmail: z.string().trim().email("Email người phụ trách mới không hợp lệ."),
  reason: z.string().trim().min(1, "Vui lòng nhập lý do điều chỉnh."),
  expectedVersion: z.number().int().min(1),
});
