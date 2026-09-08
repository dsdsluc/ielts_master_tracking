"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const DAYS_OPTIONS = [
  { value: "7", label: "7 ngày gần nhất" },
  { value: "30", label: "30 ngày gần nhất" },
  { value: "90", label: "90 ngày gần nhất" },
];

export function AdsPerformanceFilterBar({
  branches,
  sources,
}: {
  branches: { code: string; name: string }[];
  sources: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const days = searchParams.get("days") ?? "30";
  const branch = searchParams.get("branch") ?? "all";
  const source = searchParams.get("source") ?? "all";

  // Truyền sẵn items cho Select — tránh Base UI hiển thị value thô ("all")
  // thay vì nhãn, do nhãn chỉ đăng ký được sau khi popup đã mount lần đầu.
  const daysItems = Object.fromEntries(DAYS_OPTIONS.map((o) => [o.value, o.label]));
  const branchItems = { all: "Tất cả cơ sở", ...Object.fromEntries(branches.map((b) => [b.code, b.name])) };
  const sourceItems = { all: "Tất cả nguồn", ...Object.fromEntries(sources.map((s) => [s, s])) };

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    router.push(`/ads-performance?${params.toString()}`);
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:flex-wrap">
      <Select items={daysItems} value={days} onValueChange={(v) => updateParams({ days: v ?? "30" })}>
        <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DAYS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select items={branchItems} value={branch} onValueChange={(v) => updateParams({ branch: v ?? "all" })}>
        <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-36">
          <SelectValue placeholder="Tất cả cơ sở" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả cơ sở</SelectItem>
          {branches.map((b) => (
            <SelectItem key={b.code} value={b.code}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select items={sourceItems} value={source} onValueChange={(v) => updateParams({ source: v ?? "all" })}>
        <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-36">
          <SelectValue placeholder="Tất cả nguồn" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả nguồn</SelectItem>
          {sources.map((s) => (
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
        onClick={() => router.push("/ads-performance")}
      >
        <RotateCcw className="size-4" />
      </Button>
    </div>
  );
}
