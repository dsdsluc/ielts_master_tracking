"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/form-message";
import { upsertSetting } from "@/app/(app)/admin/settings/actions";

export function SettingCard({
  configGroup,
  settingKey,
  label,
  description,
  initialValue,
  isDefault,
}: {
  configGroup: string;
  settingKey: string;
  label: string;
  description: string;
  initialValue: string;
  isDefault: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setPending(true);
    setError(null);
    try {
      await upsertSetting({ configGroup, key: settingKey, value });
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
        <p className="font-medium text-foreground">{label}</p>
        {isDefault && (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-condensed text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Đang dùng mặc định
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`setting-${settingKey}`} className="font-mono text-xs text-muted-foreground">
            {configGroup}.{settingKey}
          </Label>
          <Input
            id={`setting-${settingKey}`}
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
