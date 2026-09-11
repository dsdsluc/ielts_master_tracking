"use client";

import { apiFetch, apiRequest, ApiClientError } from "@/lib/api-client";
import type {
  DuplicateConflict,
  InteractionDetail,
  LeadStatus,
  PagedInteractions,
  QueueResponse,
} from "@/app/(app)/leads/types";

export async function fetchQueue(): Promise<QueueResponse> {
  return apiFetch<QueueResponse>("/api/interactions/queue", { cache: "no-store" });
}

export async function fetchInteractions(params: {
  status?: string; // 1 trạng thái, hoặc nhiều trạng thái nối dấu phẩy
  needsFollowup?: boolean;
  mine?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<PagedInteractions> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.needsFollowup) search.set("needsFollowup", "true");
  if (params.mine) search.set("mine", "true");
  if (params.search) search.set("search", params.search);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));

  return apiFetch<PagedInteractions>(`/api/interactions?${search.toString()}`, { cache: "no-store" });
}

export async function fetchInteractionDetail(id: string): Promise<InteractionDetail> {
  return apiFetch<InteractionDetail>(`/api/interactions/${id}`, { cache: "no-store" });
}

export async function logTouch(id: string, note?: string): Promise<void> {
  await apiFetch(`/api/interactions/${id}/touches`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
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

export async function resolveFollowup(id: string): Promise<InteractionDetail> {
  return apiFetch<InteractionDetail>(`/api/interactions/${id}/followup/resolve`, { method: "POST" });
}

export type LeadInfoPayload = {
  rawLink: string;
  customerName: string;
  fanpageName: string;
  adId?: string;
  customerObjectName: string;
  assignedBranchCode: string;
  conversationLink?: string;
  // Xác nhận vẫn tạo/lưu dù hệ thống nghi trùng với 1 hội thoại gần đây —
  // đúng tên field server mong đợi (resolveLeadInfo đọc duplicateConfirmed/
  // duplicateReason, KHÔNG có field "overrideReason" nào cả).
  duplicateConfirmed?: boolean;
  duplicateReason?: string;
};

export type CreateInteractionInput = LeadInfoPayload;

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
