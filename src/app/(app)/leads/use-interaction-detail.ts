"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchInteractionDetail, logTouch, resolveFollowup, updateStatus } from "@/app/(app)/leads/leads-api";
import type { InteractionDetail } from "@/app/(app)/leads/types";
import { useToast } from "@/hooks/use-toast";

/** Tải chi tiết 1 liên hệ + các hành động dùng chung giữa panel xem nhanh
 * (lead-detail-sheet.tsx) và trang làm việc đầy đủ (leads/[id]) — 2 nơi khác
 * layout nhưng cùng 1 tập dữ liệu/hành động, tách ra để không viết lặp lại. */
export function useInteractionDetail(interactionId: string | null, onChanged?: () => void) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<InteractionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touchPending, setTouchPending] = useState(false);
  const [followupPending, setFollowupPending] = useState(false);

  const load = useCallback((id: string) => {
    setLoading(true);
    setError(null);
    fetchInteractionDetail(id)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được liên hệ."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Fetch-on-open/mount: no external store to subscribe to for a REST
    // detail call, so this is the standard data-fetching effect shape.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (interactionId) load(interactionId);
    else setDetail(null);
  }, [interactionId, load]);

  function refresh() {
    if (interactionId) load(interactionId);
    onChanged?.();
  }

  async function handleLogTouch(note?: string) {
    if (!interactionId) return false;
    setTouchPending(true);
    try {
      await logTouch(interactionId, note);
      toast.success("Đã ghi nhận lượt liên hệ.");
      refresh();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không ghi nhận được.";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setTouchPending(false);
    }
  }

  async function handleResolveFollowup() {
    if (!interactionId) return;
    setFollowupPending(true);
    try {
      const updated = await resolveFollowup(interactionId);
      if (updated.status === "Spam") {
        toast.info("Đã tự động chuyển Spam — liên hệ này đã bị nhắc chăm sóc lại quá số lần cho phép theo cấu hình hệ thống.");
      } else {
        toast.success("Đã đánh dấu xử lý xong yêu cầu chăm sóc lại.");
      }
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không cập nhật được.";
      setError(message);
      toast.error(message);
    } finally {
      setFollowupPending(false);
    }
  }

  async function handleMoveToInProgress() {
    if (!interactionId || !detail) return;
    setTouchPending(true);
    try {
      await updateStatus(interactionId, { status: "Tiếp nhận", expectedVersion: detail.version });
      toast.success("Đã chuyển sang Tiếp nhận.");
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không cập nhật được.";
      setError(message);
      toast.error(message);
    } finally {
      setTouchPending(false);
    }
  }

  return {
    detail,
    loading,
    error,
    setError,
    refresh,
    touchPending,
    followupPending,
    handleLogTouch,
    handleResolveFollowup,
    handleMoveToInProgress,
  };
}
