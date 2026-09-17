// Port validateLeadPayload_ (LeadService.gs) — chuẩn hóa + validate toàn bộ
// thông tin khách mà Sale nhập khi tạo/sửa một Interaction.
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/interactions/errors";
import { EXTERNAL_LEAD_FANPAGE } from "@/lib/interactions/constants";
import { canonicalizeLink, normalizePhone, validateConversationLink } from "@/lib/interactions/link";
import { detectSourceFromLink, assertFanpageMatchesSource, suggestBranchFromFanpage, sourceRequiresAdId } from "@/lib/interactions/source-detection";
import { canAccessBranch } from "@/lib/interactions/scope";
import type { CurrentUser } from "@/lib/auth/dal";
import type { ExternalCreateLeadInput, LeadInfoInput } from "@/lib/interactions/validation";

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

/**
 * Tab "Ngoài" (không qua Link) — Sale tự chọn Nguồn, tự chọn Cơ sở, bắt buộc
 * có SĐT ngay lúc tạo. Không có Link/Fanpage thật nên:
 * - fanpageName gán cố định EXTERNAL_LEAD_FANPAGE (placeholder, xem
 *   constants.ts) — chỉ để thỏa khóa ngoại bắt buộc, không đối chiếu lại với
 *   sourceName (khác luồng Facebook, ở đây Sale được chọn Nguồn tự do).
 * - canonicalLink sinh giả duy nhất theo SĐT đã chuẩn hóa, để tái dùng nguyên
 *   cơ chế chống trùng lặp + customerKey theo canonicalLink (findDuplicateInfo/
 *   makeCustomerKey) thay vì viết logic riêng cho luồng này.
 */
export async function resolveExternalLeadInfo(actor: CurrentUser, input: ExternalCreateLeadInput): Promise<ResolvedLeadInfo> {
  const assignedBranchCode = input.assignedBranchCode.trim();
  const branch = await prisma.branch.findFirst({ where: { code: assignedBranchCode, active: true } });
  if (!branch) throw new ApiError(422, "VALIDATION_ERROR", "Cơ sở không có trong danh mục hoặc đang ngừng hoạt động.");
  if (!canAccessBranch(actor, assignedBranchCode)) throw new ApiError(403, "FORBIDDEN", "Bạn không được tạo hội thoại cho cơ sở này.");

  const source = await prisma.source.findFirst({ where: { name: input.sourceName, active: true } });
  if (!source) throw new ApiError(422, "VALIDATION_ERROR", "Nguồn không có trong danh mục hoặc đang ngừng hoạt động.");

  const customerObjectName = (input.customerObjectName || DEFAULT_OBJECT).trim() || DEFAULT_OBJECT;
  const object = await prisma.customerObject.findFirst({ where: { name: customerObjectName, active: true } });
  if (!object) throw new ApiError(422, "VALIDATION_ERROR", "Đối tượng không có trong danh mục.");

  const phone = normalizePhone(input.phoneRaw);
  if (!phone) throw new ApiError(422, "VALIDATION_ERROR", "Số điện thoại không hợp lệ.");

  const canonicalLink = `external:phone:${phone}`;

  return {
    rawLink: canonicalLink,
    canonicalLink,
    customerName: input.customerName.trim(),
    sourceName: source.name,
    fanpageName: EXTERNAL_LEAD_FANPAGE,
    adId: "",
    customerObjectName,
    assignedBranchCode,
    suggestedBranchCode: assignedBranchCode,
    conversationLink: "",
    duplicateConfirmed: !!input.duplicateConfirmed,
    duplicateReason: (input.duplicateReason ?? "").trim(),
  };
}
