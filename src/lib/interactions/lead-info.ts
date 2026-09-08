// Port validateLeadPayload_ (LeadService.gs) — chuẩn hóa + validate toàn bộ
// thông tin khách mà Sale nhập khi tạo/sửa một Interaction.
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/interactions/errors";
import { canonicalizeLink, validateConversationLink } from "@/lib/interactions/link";
import { detectSourceFromLink, assertFanpageMatchesSource, suggestBranchFromFanpage, sourceRequiresAdId } from "@/lib/interactions/source-detection";
import { canAccessBranch } from "@/lib/interactions/scope";
import type { CurrentUser } from "@/lib/auth/dal";
import type { LeadInfoInput } from "@/lib/interactions/validation";

const DEFAULT_OBJECT = "Chưa rõ";

export type ResolvedLeadInfo = {
  rawLink: string;
  canonicalLink: string;
  customerName: string;
  sourceName: string;
  fanpageName: string;
  adId: string;
  customerObjectName: string;
  assignedBranchCode: string;
  suggestedBranchCode: string;
  conversationLink: string;
  duplicateConfirmed: boolean;
  duplicateReason: string;
};

export async function resolveLeadInfo(actor: CurrentUser, input: LeadInfoInput): Promise<ResolvedLeadInfo> {
  const canonicalLink = canonicalizeLink(input.rawLink);
  if (!canonicalLink) throw new ApiError(422, "VALIDATION_ERROR", "Link khách hàng không hợp lệ hoặc không thể chuẩn hóa.");

  const { sourceName } = await detectSourceFromLink(input.rawLink);
  await assertFanpageMatchesSource(input.fanpageName, sourceName);

  const suggestedBranchCode = (await suggestBranchFromFanpage(input.fanpageName)) ?? "";
  const assignedBranchCode = (input.assignedBranchCode || suggestedBranchCode || "").trim();
  if (!assignedBranchCode) throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng nhập/chọn Cơ sở phụ trách.");

  const branch = await prisma.branch.findFirst({ where: { code: assignedBranchCode, active: true } });
  if (!branch) throw new ApiError(422, "VALIDATION_ERROR", "Cơ sở không có trong danh mục hoặc đang ngừng hoạt động.");
  if (!canAccessBranch(actor, assignedBranchCode)) throw new ApiError(403, "FORBIDDEN", "Bạn không được tạo/sửa hội thoại cho cơ sở này.");

  const customerObjectName = (input.customerObjectName || DEFAULT_OBJECT).trim() || DEFAULT_OBJECT;
  const object = await prisma.customerObject.findFirst({ where: { name: customerObjectName, active: true } });
  if (!object) throw new ApiError(422, "VALIDATION_ERROR", "Đối tượng không có trong danh mục.");

  const adId = (input.adId ?? "").trim();
  if (adId.length > 100) throw new ApiError(422, "VALIDATION_ERROR", "Ad ID quá dài.");
  if ((await sourceRequiresAdId(sourceName, input.fanpageName)) && !adId) {
    throw new ApiError(422, "VALIDATION_ERROR", "Ad ID là bắt buộc với Nguồn/Fanpage đang chọn.");
  }

  const conversationLink = validateConversationLink(input.conversationLink);

  return {
    rawLink: input.rawLink.trim(),
    canonicalLink,
    customerName: input.customerName.trim(),
    sourceName,
    fanpageName: input.fanpageName.trim(),
    adId,
    customerObjectName,
    assignedBranchCode,
    suggestedBranchCode: suggestedBranchCode || assignedBranchCode,
    conversationLink,
    duplicateConfirmed: !!input.duplicateConfirmed,
    duplicateReason: (input.duplicateReason ?? "").trim(),
  };
}
