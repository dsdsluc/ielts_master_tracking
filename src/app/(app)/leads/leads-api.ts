"use client";

import type {
  ApiError,
  DuplicateConflict,
  InteractionDetail,
  LeadStatus,
  PagedInteractions,
  QueueResponse,
} from "@/app/(app)/leads/types";

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ApiError | null)?.error ?? `Lỗi ${res.status}`;
    throw new Error(err);
  }
  return body as T;
}

export async function fetchQueue(): Promise<QueueResponse> {
  const res = await fetch("/api/interactions/queue", {
    credentials: "same-origin",
    cache: "no-store",
  });
  return parseJson<QueueResponse>(res);
}

export async function fetchInteractions(params: {
  status?: string; // 1 trạng thái, hoặc nhiều trạng thái nối dấu phẩy
  needsFollowup?: boolean;
  mine?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<PagedInteractions> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.needsFollowup) search.set("needsFollowup", "true");
  if (params.mine) search.set("mine", "true");
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));

  const res = await fetch(`/api/interactions?${search.toString()}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  return parseJson(res);
}

export async function fetchInteractionDetail(id: string): Promise<InteractionDetail> {
  const res = await fetch(`/api/interactions/${id}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  return parseJson<InteractionDetail>(res);
}

export async function logTouch(id: string, note?: string): Promise<void> {
  const res = await fetch(`/api/interactions/${id}/touches`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  await parseJson(res);
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
  const res = await fetch(`/api/interactions/${id}/status`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await parseJson(res);
}

export async function resolveFollowup(id: string): Promise<void> {
  const res = await fetch(`/api/interactions/${id}/followup/resolve`, {
    method: "POST",
    credentials: "same-origin",
  });
  await parseJson(res);
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
  const res = await fetch("/api/interactions", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 409) {
    const body = (await res.json()) as DuplicateConflict;
    return { status: 409, ...body };
  }
  return parseJson(res);
}

export async function updateInteractionInfo(
  id: string,
  input: LeadInfoPayload & { expectedVersion: number }
): Promise<InteractionDetail | ({ status: 409 } & DuplicateConflict)> {
  const res = await fetch(`/api/interactions/${id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 409) {
    const body = (await res.json()) as DuplicateConflict;
    return { status: 409, ...body };
  }
  return parseJson(res);
}
