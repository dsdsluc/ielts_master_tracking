"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const GROUP_BY_OPTIONS = [
  { value: "status", label: "Trạng thái" },
  { value: "branch", label: "Cơ sở" },
  { value: "source", label: "Nguồn" },
];

const DAYS_OPTIONS = [
  { value: "7", label: "7 ngày gần nhất" },
  { value: "30", label: "30 ngày gần nhất" },
  { value: "90", label: "90 ngày gần nhất" },
];

export function DashboardFilterBar({
  branches,
  sources,
}: {
  branches: { code: string; name: string }[];
  sources: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const groupBy = searchParams.get("groupBy") ?? "status";
  const days = searchParams.get("days") ?? "30";
  const branch = searchParams.get("branch") ?? "all";
  const source = searchParams.get("source") ?? "all";

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:flex-wrap">
      <Select value={groupBy} onValueChange={(v) => updateParams({ groupBy: v ?? "status" })}>
        <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-40">
          <SlidersHorizontal className="size-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GROUP_BY_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              Nhóm theo {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={days} onValueChange={(v) => updateParams({ days: v ?? "30" })}>
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

      <Select value={branch} onValueChange={(v) => updateParams({ branch: v ?? "all" })}>
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

      <Select value={source} onValueChange={(v) => updateParams({ source: v ?? "all" })}>
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
        onClick={() => router.push("/")}
      >
        <RotateCcw className="size-4" />
      </Button>
    </div>
  );
}
