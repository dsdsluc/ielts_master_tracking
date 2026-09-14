"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/form-message";
import { upsertSetting } from "@/app/(app)/admin/settings/actions";

const DEFAULT_TARGET = "100";

export function KpiTargetCard({
  currentMonth,
  savedTargets,
}: {
  currentMonth: string;
  savedTargets: Record<string, string>;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth);
  const [value, setValue] = useState(savedTargets[currentMonth] ?? DEFAULT_TARGET);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDefault = !(month in savedTargets);

  function handleMonthChange(next: string) {
    if (!next) return;
    setMonth(next);
    setValue(savedTargets[next] ?? DEFAULT_TARGET);
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    setPending(true);
    setError(null);
    try {
      await upsertSetting({ configGroup: "kpi", key: month, value });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <p className="font-medium text-foreground">Chỉ tiêu chốt học viên theo tháng</p>
        {isDefault && (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-condensed text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Đang dùng mặc định
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Số học viên cần chốt (Đã chốt) trong tháng — tháng nào chưa nhập sẽ mặc định 100.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kpi-target-month" className="font-mono text-xs text-muted-foreground">
            Tháng
          </Label>
          <Input
            id="kpi-target-month"
            type="month"
            value={month}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="h-10 w-40 rounded-xl font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kpi-target-value" className="font-mono text-xs text-muted-foreground">
            kpi.{month}
          </Label>
          <Input
            id="kpi-target-value"
            type="number"
            min={1}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            className="h-10 w-32 rounded-xl font-mono"
          />
        </div>
        <Button type="button" onClick={handleSave} disabled={pending} className="h-10 rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90">
          {pending ? <LoaderCircle className="animate-spin" /> : <Save className="size-4" />}
          Lưu
        </Button>
        {saved && !pending && <span className="text-xs text-status-qualified">Đã lưu.</span>}
      </div>
      {error && <FormMessage kind="error" className="mt-2">{error}</FormMessage>}
    </div>
  );
}
