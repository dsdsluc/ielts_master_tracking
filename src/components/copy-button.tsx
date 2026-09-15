"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function CopyButton({ value, label = "Đã copy" }: { value: string; label?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(label);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Trình duyệt chặn quyền sao chép.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
      aria-label="Sao chép"
    >
      {copied ? <Check className="size-3.5 text-status-qualified" /> : <Copy className="size-3.5" />}
    </button>
  );
}
