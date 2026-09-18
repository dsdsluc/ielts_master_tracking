"use client";

import { apiFetch, apiRequest, ApiClientError } from "@/lib/api-client";
import type {
  DuplicateConflict,
  InteractionDetail,
  InteractionListItem,
  LeadStatus,
  PagedInteractions,
  QueueResponse,
} from "@/app/(app)/leads/types";

export async function fetchQueue(): Promise<QueueResponse> {
  return apiFetch<QueueResponse>("/api/interactions/queue", { cache: "no-store" });
}

export async function fetchInteractions(params: {
  status?: string; // 1 trạng thái, hoặc nhiều trạng thái nối dấu phẩy
  mine?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<PagedInteractions> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.mine) search.set("mine", "true");
  if (params.search) search.set("search", params.search);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));

  return apiFetch<PagedInteractions>(`/api/interactions?${search.toString()}`, { cache: "no-store" });
}

const OPEN_INTERACTIONS_CACHE_TTL_MS = 30_000;
let openInteractionsCache: { userKey: string; items: InteractionListItem[]; expiresAt: number } | null = null;
let openInteractionsRequest: { userKey: string; promise: Promise<InteractionListItem[]> } | null = null;

export function getCachedOpenInteractions(userKey: string): InteractionListItem[] | null {
  return openInteractionsCache?.userKey === userKey ? openInteractionsCache.items : null;
}

/** Cache module-level sống xuyên các lần điều hướng SPA; request đồng thời được
 * gộp lại để React Strict Mode hoặc nhiều consumer không gọi DB trùng nhau. */
export async function fetchOpenInteractions(options: { userKey: string; force?: boolean }): Promise<InteractionListItem[]> {
  const now = Date.now();
  if (!options.force && openInteractionsCache?.userKey === options.userKey && openInteractionsCache.expiresAt > now) {
    return openInteractionsCache.items;
  }
  if (openInteractionsRequest?.userKey === options.userKey) return openInteractionsRequest.promise;

  const request = apiFetch<{ items: InteractionListItem[] }>("/api/interactions/open", { cache: "no-store" })
    .then(({ items }) => {
      openInteractionsCache = { userKey: options.userKey, items, expiresAt: Date.now() + OPEN_INTERACTIONS_CACHE_TTL_MS };
      return items;
    })
    .finally(() => {
      if (openInteractionsRequest?.promise === request) openInteractionsRequest = null;
    });
  openInteractionsRequest = { userKey: options.userKey, promise: request };
  return request;
}

export function invalidateOpenInteractionsCache(): void {
  openInteractionsCache = null;
}

export async function fetchInteractionDetail(id: string): Promise<InteractionDetail> {
  return apiFetch<InteractionDetail>(`/api/interactions/${id}`, { cache: "no-store" });
}

export async function updateStatus(
  id: string,
  payload: {
    status: LeadStatus;
    expectedVersion: number;
    phoneRaw?: string;
    spamReason?: string;
    confirmedMinAttempts?: boolean;
    note?: string;
  }
): Promise<void> {
  await apiFetch(`/api/interactions/${id}/status`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resolveFollowup(id: string, note: string): Promise<InteractionDetail> {
  return apiFetch<InteractionDetail>(`/api/interactions/${id}/followup/resolve`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export type AssignableSale = { email: string; fullName: string };

export async function fetchAssignableSales(): Promise<AssignableSale[]> {
  return apiFetch<AssignableSale[]>("/api/interactions/assignable-sales", { cache: "no-store" });
}

export async function reassignInteraction(
  id: string,
  payload: { targetEmail: string; reason: string; expectedVersion: number }
): Promise<InteractionDetail> {
  return apiFetch<InteractionDetail>(`/api/interactions/${id}/reassign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function reassignInteractionsBulk(payload: {
  items: { interactionId: string; expectedVersion: number }[];
  targetEmail: string;
  reason: string;
}): Promise<{ reassigned: string[]; skipped: string[] }> {
  return apiFetch("/api/interactions/reassign-bulk", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type LeadInfoPayload = {
  rawLink: string;
  customerName: string;
  fanpageName: string;
  adId?: string;
  customerObjectName: string;
  assignedBranchCode: string;
  conversationLink?: string;
  // Có giá trị thì tạo thẳng ở trạng thái "Đủ tiêu chuẩn" thay vì "Chờ" — xem
  // createInteraction() (mutations.ts).
  phoneRaw?: string;
  // Xác nhận vẫn tạo/lưu dù hệ thống nghi trùng với 1 hội thoại gần đây —
  // đúng tên field server mong đợi (resolveLeadInfo đọc duplicateConfirmed/
  // duplicateReason, KHÔNG có field "overrideReason" nào cả).
  duplicateConfirmed?: boolean;
  duplicateReason?: string;
};

// Tạo mới có 2 luồng (xem new-lead-dialog.tsx) — sửa lead vẫn dùng nguyên
// LeadInfoPayload (chỉ luồng Facebook/theo Link, không đổi).
export type CreateFacebookLeadInput = LeadInfoPayload & {
  channel: "facebook";
  // Nhập kèm mốc tư vấn (nhập Excel dữ liệu tư vấn cũ) — chỉ có tác dụng khi
  // tạo mới VÀ đủ điều kiện (có SĐT), xem createInteraction() (mutations.ts).
  stage?: string;
  stageReason?: string;
};
export type CreateExternalLeadInput = {
  channel: "external";
  customerName: string;
  sourceName: string;
  phoneRaw: string;
  assignedBranchCode: string;
  customerObjectName?: string;
  duplicateConfirmed?: boolean;
  duplicateReason?: string;
};
export type CreateInteractionInput = CreateFacebookLeadInput | CreateExternalLeadInput;

export async function createInteraction(
  input: CreateInteractionInput
): Promise<{ interactionId: string } | ({ status: 409 } & DuplicateConflict)> {
  const { res, data } = await apiRequest<DuplicateConflict & { interactionId: string }>("/api/interactions", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (res.status === 409) return { status: 409, ...(data as DuplicateConflict) };
  if (!res.ok) throw new ApiClientError(data?.error ?? `Yêu cầu thất bại (mã lỗi ${res.status}).`, res.status);
  return data as { interactionId: string };
}

export async function updateInteractionInfo(
  id: string,
  input: LeadInfoPayload & { expectedVersion: number }
): Promise<InteractionDetail | ({ status: 409 } & DuplicateConflict)> {
  const { res, data } = await apiRequest<DuplicateConflict & InteractionDetail>(`/api/interactions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (res.status === 409) return { status: 409, ...(data as DuplicateConflict) };
  if (!res.ok) throw new ApiClientError(data?.error ?? `Yêu cầu thất bại (mã lỗi ${res.status}).`, res.status);
  return data as InteractionDetail;
}
