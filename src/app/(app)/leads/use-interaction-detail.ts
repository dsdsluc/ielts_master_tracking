"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchInteractionDetail, resolveFollowup, updateStatus } from "@/app/(app)/leads/leads-api";
import type { InteractionDetail } from "@/app/(app)/leads/types";
import { useToast } from "@/hooks/use-toast";

// Cache theo interactionId, sống suốt phiên làm việc (module-level, dùng
// chung giữa mọi lần mở panel/trang chi tiết) — mở lại đúng 1 liên hệ đã xem
// trước đó thì hiện ngay dữ liệu cũ, không bắt người dùng chờ loading lại từ
// đầu. Vẫn âm thầm gọi lại API ngay sau đó (silent, không bật cờ loading) để
// đồng bộ version/trạng thái mới nhất — quan trọng vì các hành động (Đủ tiêu
// chuẩn/Spam/Điều chuyển...) đều cần đúng expectedVersion, dữ liệu cache có
// thể đã cũ nếu người khác vừa sửa liên hệ này.
const detailCache = new Map<string, InteractionDetail>();

/** Tải chi tiết 1 liên hệ + các hành động dùng chung giữa panel xem nhanh
 * (lead-detail-sheet.tsx) và trang làm việc đầy đủ (leads/[id]) — 2 nơi khác
 * layout nhưng cùng 1 tập dữ liệu/hành động, tách ra để không viết lặp lại. */
export function useInteractionDetail(interactionId: string | null, onChanged?: () => void) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<InteractionDetail | null>(() => (interactionId ? (detailCache.get(interactionId) ?? null) : null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touchPending, setTouchPending] = useState(false);
  const [followupPending, setFollowupPending] = useState(false);

  const load = useCallback((id: string, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    fetchInteractionDetail(id)
      .then((d) => {
        detailCache.set(id, d);
        setDetail(d);
      })
      .catch((err) => {
        // Bản cache cũ (nếu có) đã hiện sẵn rồi — làm mới ngầm thất bại thì
        // không cần đá người dùng về màn lỗi, âm thầm bỏ qua là đủ.
        if (!silent) setError(err instanceof Error ? err.message : "Không tải được liên hệ.");
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    // Fetch-on-open/mount: no external store to subscribe to for a REST
    // detail call, so this is the standard data-fetching effect shape.
    if (!interactionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetail(null);
      return;
    }
    const cached = detailCache.get(interactionId);
    if (cached) {
      setDetail(cached);
      load(interactionId, true);
    } else {
      load(interactionId);
    }
  }, [interactionId, load]);

  function refresh() {
    if (interactionId) load(interactionId);
    onChanged?.();
  }

  async function handleResolveFollowup(note: string) {
    if (!interactionId) return;
    setFollowupPending(true);
    try {
      await resolveFollowup(interactionId, note);
      toast.success("Đã đánh dấu chăm sóc lại — liên hệ chuyển sang Tiếp nhận.");
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không cập nhật được.";
      setError(message);
      toast.error(message);
      throw err;
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
    handleResolveFollowup,
    handleMoveToInProgress,
  };
}
