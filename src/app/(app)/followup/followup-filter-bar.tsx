"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { STATUS } from "@/lib/interactions/constants";

const STATUS_OPTIONS = [STATUS.WAITING, STATUS.PROCESSING];
const STALE_OPTIONS = [
  { value: "3", label: "≥ 3 ngày chưa hoạt động" },
  { value: "7", label: "≥ 7 ngày chưa hoạt động" },
  { value: "14", label: "≥ 14 ngày chưa hoạt động" },
];

export function FollowupFilterBar({
  branches,
  sources,
}: {
  branches: { code: string; name: string }[];
  sources: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const branch = searchParams.get("branch") ?? "all";
  const source = searchParams.get("source") ?? "all";
  const status = searchParams.get("status") ?? "all";
  const stale = searchParams.get("stale") ?? "all";
  const hasFilters = branch !== "all" || source !== "all" || status !== "all" || stale !== "all";

  // Truyền sẵn items cho Select — tránh Base UI hiển thị value thô ("all")
  // thay vì nhãn, do nhãn chỉ đăng ký được sau khi popup đã mount lần đầu.
  const branchItems = { all: "Tất cả cơ sở", ...Object.fromEntries(branches.map((b) => [b.code, b.name])) };
  const sourceItems = { all: "Tất cả nguồn", ...Object.fromEntries(sources.map((s) => [s, s])) };
  const statusItems = { all: "Tất cả trạng thái", ...Object.fromEntries(STATUS_OPTIONS.map((s) => [s, s])) };
  const staleItems = { all: "Mọi thời điểm", ...Object.fromEntries(STALE_OPTIONS.map((o) => [o.value, o.label])) };

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    router.push(`/followup?${params.toString()}`);
  }

  return (
    <div className="shadow-bubble mb-6 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex shrink-0 items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <SlidersHorizontal className="size-3.5" />
        Bộ lọc
      </div>

      <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select items={statusItems} value={status} onValueChange={(v) => updateParams({ status: v ?? "all" })}>
          <SelectTrigger className="h-10 w-full rounded-xl bg-background">
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

        <Select items={staleItems} value={stale} onValueChange={(v) => updateParams({ stale: v ?? "all" })}>
          <SelectTrigger className="h-10 w-full rounded-xl bg-background">
            <SelectValue placeholder="Mọi thời điểm" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi thời điểm</SelectItem>
            {STALE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select items={branchItems} value={branch} onValueChange={(v) => updateParams({ branch: v ?? "all" })}>
          <SelectTrigger className="h-10 w-full rounded-xl bg-background">
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
          <SelectTrigger className="h-10 w-full rounded-xl bg-background">
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
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Xoá bộ lọc"
        disabled={!hasFilters}
        className="mx-auto shrink-0 rounded-xl text-status-received hover:bg-status-received-bg hover:text-status-received disabled:opacity-30 sm:mx-0"
        onClick={() => router.push("/followup")}
      >
        <RotateCcw className="size-4" />
      </Button>
    </div>
  );
}
