"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SPAM_REASON_MIN_LENGTH } from "@/lib/interactions/constants";
import { cn } from "@/lib/utils";

/** Ô nhập lý do Spam dùng chung giữa SpamDialog (leads) và FollowupView
 * (Marketing đóng Spam trực tiếp) — nhập tay tự do, các nút bên trên chỉ là
 * gợi ý nhanh điền sẵn vào ô, không còn ép chọn đúng 1 trong số cố định. */
export function SpamReasonField({
  id = "spam-reason",
  value,
  onChange,
  quickOptions,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  quickOptions: readonly { code: string; label: string }[];
  disabled?: boolean;
}) {
  const trimmedLength = value.trim().length;
  const tooShort = trimmedLength > 0 && trimmedLength <= SPAM_REASON_MIN_LENGTH;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Lý do đóng Spam</Label>
      <div className="flex flex-wrap gap-1.5">
        {quickOptions.map((o) => (
          <button
            key={o.code}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.label)}
            className="rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-xs text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {o.label}
          </button>
        ))}
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Bấm gợi ý ở trên hoặc gõ hẳn lý do riêng…"
        aria-invalid={tooShort}
        className={cn("min-h-20 rounded-xl bg-background", tooShort && "border-destructive/50")}
      />
      <p className={cn("text-[11px]", tooShort ? "text-destructive" : "text-muted-foreground")}>
        {tooShort ? `Cần nhập trên ${SPAM_REASON_MIN_LENGTH} ký tự.` : "Có thể sửa lại gợi ý hoặc gõ hẳn lý do riêng — trên 5 ký tự là được."}
      </p>
    </div>
  );
}
