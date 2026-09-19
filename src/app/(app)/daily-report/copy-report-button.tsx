"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function CopyReportButton({ text }: { text: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Đã copy báo cáo.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Trình duyệt chặn quyền sao chép.");
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" className="h-9 rounded-full" onClick={handleCopy}>
      {copied ? <Check className="size-3.5 text-status-qualified" /> : <Copy className="size-3.5" />}
      Copy báo cáo
    </Button>
  );
}
