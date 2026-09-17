"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function LogsStatsFilterBar({ roleOptions }: { roleOptions: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQ = searchParams.get("q") ?? "";
  const role = searchParams.get("role") ?? "all";
  const [q, setQ] = useState(currentQ);

  const roleItems = { all: "Tất cả vai trò", ...Object.fromEntries(roleOptions.map((r) => [r, r])) };

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
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
      <div className="relative sm:w-56">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên, email…"
          className="h-10 rounded-xl bg-background pr-3 pl-9"
        />
      </div>
      <Select items={roleItems} value={role} onValueChange={(v) => updateParams({ role: v })}>
        <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-40">
          <SelectValue placeholder="Tất cả vai trò" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả vai trò</SelectItem>
          {roleOptions.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
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
