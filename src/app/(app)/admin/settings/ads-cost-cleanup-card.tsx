"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { FormMessage } from "@/components/form-message";
import { upsertSetting } from "@/app/(app)/admin/settings/actions";

export function AdsCostCleanupCard({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(next: boolean) {
    setEnabled(next);
    setPending(true);
    setError(null);
    try {
      await upsertSetting({ configGroup: "system", key: "ADS_COST_CLEANUP_ENABLED", value: next ? "true" : "false" });
      router.refresh();
    } catch (err) {
      setEnabled(!next);
      setError(err instanceof Error ? err.message : "Không lưu được.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <p className="font-medium text-foreground">Cho phép dọn dẹp Chi phí quảng cáo</p>
        {enabled && (
          <span className="rounded-full bg-status-qualified-bg px-2 py-0.5 font-condensed text-[10px] font-semibold tracking-wide text-status-qualified uppercase">
            Đang bật
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Khi bật, Marketing/Admin sẽ thấy nút &quot;Dọn dẹp&quot; ở trang Chi phí quảng cáo để chọn và xoá bớt bản ghi. Nhớ tắt lại sau khi dọn xong.
      </p>
      <div className="flex items-center gap-3">
        <Switch checked={enabled} onCheckedChange={handleToggle} disabled={pending} />
        {pending && <LoaderCircle className="size-4 animate-spin text-muted-foreground" />}
      </div>
      {error && <FormMessage kind="error" className="mt-2">{error}</FormMessage>}
    </div>
  );
}
