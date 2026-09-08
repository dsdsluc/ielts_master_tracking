// Port findDuplicateInfoFromRows_/classifyInteractionAgainstPrevious_ (DuplicateService.gs).
import { prisma } from "@/lib/prisma";
import { INTERACTION_TYPE, ROLES } from "@/lib/interactions/constants";
import { canAccessBranch } from "@/lib/interactions/scope";
import { getDuplicateWindowHours } from "@/lib/interactions/settings";
import type { CurrentUser } from "@/lib/auth/dal";

export type DuplicateInfo = {
  classification: string;
  confirmedClassification: string;
  requiresConfirmation: boolean;
  message: string;
  existingCustomerKey: string | null;
  interactionCount: number;
};

/**
 * Dựng body 409 cho client (new-lead-dialog.tsx và trang chỉnh sửa) — dùng
 * chung cho cả tạo mới lẫn sửa, vì Errors.duplicateConfirmRequired() chỉ mang
 * DuplicateInfo (không có tên khách/ngày tạo), phải tra lại 1 lần nữa.
 */
export async function buildDuplicateConflictResponse(dup: DuplicateInfo) {
  const row = dup.existingCustomerKey
    ? await prisma.interaction.findFirst({
        where: { customerKey: dup.existingCustomerKey, activeFlag: true },
        orderBy: { createdAt: "desc" },
        select: { interactionId: true, customerName: true, createdLeadAt: true, assignedSale: { select: { fullName: true } } },
      })
    : null;

  return {
    duplicate: {
      interactionId: row?.interactionId ?? "",
      customerName: row?.customerName ?? "",
      createdLeadAt: (row?.createdLeadAt ?? new Date()).toISOString(),
      assignedSaleName: row?.assignedSale?.fullName ?? null,
    },
  };
}

function classifyAgainstPrevious(previous: { adId: string | null; fanpageName: string }, adId: string, fanpageName: string): string {
  if ((previous.adId ?? "") !== adId || previous.fanpageName !== fanpageName) return INTERACTION_TYPE.REMARKETING;
  return INTERACTION_TYPE.REPEAT;
}

/**
 * Tìm lịch sử theo Link_chuẩn trong phạm vi actor được xem (Sale chỉ thấy
 * cơ sở của mình — dedup cũng chỉ soi trong phạm vi đó, đúng hành vi gốc).
 * excludeInteractionId dùng khi sửa một interaction đang có sẵn.
 */
export async function findDuplicateInfo(
  actor: CurrentUser,
  canonicalLink: string,
  adId: string,
  fanpageName: string,
  excludeInteractionId?: string
): Promise<DuplicateInfo> {
  const rows = await prisma.interaction.findMany({
    where: {
      canonicalLink,
      activeFlag: true,
      interactionId: excludeInteractionId ? { not: excludeInteractionId } : undefined,
    },
    orderBy: { createdAt: "desc" },
    select: { customerKey: true, adId: true, fanpageName: true, createdAt: true, createdLeadAt: true, assignedBranchCode: true },
  });

  const visible = actor.role === ROLES.SALES ? rows.filter((r) => canAccessBranch(actor, r.assignedBranchCode)) : rows;

  if (!visible.length) {
    return {
      classification: INTERACTION_TYPE.NEW,
      confirmedClassification: INTERACTION_TYPE.NEW,
      requiresConfirmation: false,
      message: "Chưa phát hiện lịch sử theo link chuẩn hóa.",
      existingCustomerKey: null,
      interactionCount: 0,
    };
  }

  const windowMs = (await getDuplicateWindowHours()) * 60 * 60 * 1000;
  const now = Date.now();
  const recentExact = visible.find((r) => {
    const dt = (r.createdAt ?? r.createdLeadAt).getTime();
    if (now - dt > windowMs) return false;
    const sameAd = adId && r.adId === adId;
    const bothNoAd = !adId && !r.adId;
    const sameFanpage = fanpageName && r.fanpageName === fanpageName;
    return sameAd || bothNoAd || sameFanpage;
  });

  const confirmedClassification = classifyAgainstPrevious(visible[0], adId, fanpageName);

  return {
    classification: recentExact ? INTERACTION_TYPE.SUSPECT_DUP : confirmedClassification,
    confirmedClassification,
    requiresConfirmation: !!recentExact,
    message: recentExact
      ? "Đã có hội thoại gần đây của cùng khách. Chỉ lưu mới khi khách thực sự quay lại tạo một lượt hội thoại mới."
      : "Đã tìm thấy lịch sử tương tác của khách này.",
    existingCustomerKey: visible[0].customerKey,
    interactionCount: visible.length,
  };
}

/** Lần_tương_tác + First/Last_touch_Ad_ID — port getCustomerTouch_(). */
export async function getCustomerTouch(customerKey: string, newAdId: string) {
  const rows = await prisma.interaction.findMany({
    where: { customerKey, activeFlag: true },
    orderBy: { createdAt: "asc" },
    select: { adId: true },
  });
  const ads = rows.map((r) => r.adId).filter((v): v is string => !!v);
  if (newAdId) ads.push(newAdId);
  return {
    firstTouchAdId: ads[0] ?? null,
    lastTouchAdId: ads.length ? ads[ads.length - 1] : null,
    sequence: rows.length + 1,
  };
}
