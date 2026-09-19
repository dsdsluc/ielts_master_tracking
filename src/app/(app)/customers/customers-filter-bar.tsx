"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CUSTOMER_STAGE_VALUES } from "@/lib/interactions/constants";

const ALL = "all";

// Gộp ô tìm kiếm + lọc mốc tư vấn vào 1 thanh, cùng cập nhật chung 1 bộ
// URLSearchParams (mirror LogsFilterBar) — tránh 2 điều khiển ghi đè nhau
// (vd đổi mốc lọc làm mất từ khoá đang tìm) như khi CustomersStageFilter còn
// đứng riêng.
export function CustomersFilterBar({ q, stage }: { q: string; stage: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState(q);

  const stageItems = { [ALL]: "Tất cả mốc tư vấn", none: "Chưa gọi", ...Object.fromEntries(CUSTOMER_STAGE_VALUES.map((s) => [s, s])) };

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === ALL) params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/customers?${qs}` : "/customers");
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      if (draft !== q) updateParams({ q: draft });
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <div className="relative sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Tìm tên, SĐT, Sale tư vấn…"
          className="h-10 rounded-xl bg-background pr-3 pl-9"
        />
      </div>
      <Select value={stage ?? ALL} onValueChange={(v) => updateParams({ stage: v })} items={stageItems}>
        <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-52">
          <SelectValue placeholder="Lọc theo mốc tư vấn" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tất cả mốc tư vấn</SelectItem>
          <SelectItem value="none">Chưa gọi</SelectItem>
          {CUSTOMER_STAGE_VALUES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
