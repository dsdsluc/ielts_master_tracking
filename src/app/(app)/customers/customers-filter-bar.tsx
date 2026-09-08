"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { STATUS } from "@/lib/interactions/constants";

const STATUS_OPTIONS = [STATUS.WAITING, STATUS.PROCESSING, STATUS.PHONE, STATUS.SPAM];

export function CustomersFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQ = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "all";
  const [q, setQ] = useState(currentQ);

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page"); // đổi bộ lọc thì quay lại trang 1
    router.push(`/customers?${params.toString()}`);
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
      <div className="relative sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm tên, SĐT, mã khách hàng…"
          className="h-10 rounded-xl bg-background pr-3 pl-9"
        />
      </div>
      <Select value={status} onValueChange={(v) => updateParams({ status: v })}>
        <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-44">
          <SlidersHorizontal className="size-3.5 text-muted-foreground" />
          <SelectValue placeholder="Tất cả trạng thái" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả trạng thái</SelectItem>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
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
          router.push("/customers");
        }}
      >
        <RotateCcw className="size-4" />
      </Button>
    </div>
  );
}
