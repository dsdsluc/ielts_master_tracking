"use client";

import { apiFetch } from "@/lib/api-client";

export async function restoreSpam(interactionIds: string[], note?: string): Promise<{ restored: number; skipped: number }> {
  return apiFetch("/api/interactions/spam/restore", {
    method: "POST",
    body: JSON.stringify({ interactionIds, note: note || undefined }),
  });
}

export async function deleteSpam(interactionIds: string[], reason?: string): Promise<{ deleted: number; skipped: number }> {
  return apiFetch("/api/interactions/spam/delete", {
    method: "POST",
    body: JSON.stringify({ interactionIds, reason: reason || undefined }),
  });
}
