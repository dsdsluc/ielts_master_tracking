"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LOG_ACTION_LABELS, LOG_RESULT_LABELS } from "@/app/(app)/logs/format";

export function LogsFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQ = searchParams.get("q") ?? "";
  const action = searchParams.get("action") ?? "all";
  const result = searchParams.get("result") ?? "all";
  const [q, setQ] = useState(currentQ);

  // Truyền sẵn items cho Select — tránh Base UI hiển thị value thô ("all")
  // thay vì nhãn, do nhãn chỉ đăng ký được sau khi popup đã mount lần đầu.
  const actionItems = { all: "Tất cả hành động", ...LOG_ACTION_LABELS };
  const resultItems = { all: "Tất cả kết quả", ...LOG_RESULT_LABELS };

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    router.push(`/logs?${params.toString()}`);
  }

  useEffect(() => {
    // Gõ xong mới lọc (debounce) — tránh điều hướng trang liên tục theo từng phím gõ.
    const handle = setTimeout(() => {
      if (q !== currentQ) updateParams({ q });
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <div className="relative sm:w-60">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm người thực hiện, mã liên hệ…"
          className="h-10 rounded-xl bg-background pr-3 pl-9"
        />
      </div>
      <Select items={actionItems} value={action} onValueChange={(v) => updateParams({ action: v })}>
        <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-48">
          <SelectValue placeholder="Tất cả hành động" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả hành động</SelectItem>
          {Object.entries(LOG_ACTION_LABELS).map(([code, label]) => (
            <SelectItem key={code} value={code}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select items={resultItems} value={result} onValueChange={(v) => updateParams({ result: v })}>
        <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-36">
          <SelectValue placeholder="Tất cả kết quả" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả kết quả</SelectItem>
          {Object.entries(LOG_RESULT_LABELS).map(([code, label]) => (
            <SelectItem key={code} value={code}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Xoá bộ lọc"
        className="mx-auto shrink-0 rounded-xl text-status-received hover:bg-status-received-bg hover:text-status-received sm:mx-0"
        onClick={() => {
          setQ("");
          router.push("/logs");
        }}
      >
        <RotateCcw className="size-4" />
      </Button>
    </div>
  );
}
