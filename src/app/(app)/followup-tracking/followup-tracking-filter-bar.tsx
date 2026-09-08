"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const RESOLVED_OPTIONS = [
  { value: "pending", label: "Đang chờ xử lý" },
  { value: "resolved", label: "Đã xử lý" },
];
const DAYS_OPTIONS = [
  { value: "7", label: "7 ngày gần nhất" },
  { value: "30", label: "30 ngày gần nhất" },
  { value: "90", label: "90 ngày gần nhất" },
];

export function FollowupTrackingFilterBar({ branches }: { branches: { code: string; name: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const branch = searchParams.get("branch") ?? "all";
  const resolved = searchParams.get("resolved") ?? "all";
  const days = searchParams.get("days") ?? "all";
  const hasFilters = branch !== "all" || resolved !== "all" || days !== "all";

  // Truyền sẵn items cho Select — tránh Base UI hiển thị value thô ("all")
  // thay vì nhãn, do nhãn chỉ đăng ký được sau khi popup đã mount lần đầu.
  const branchItems = { all: "Tất cả cơ sở", ...Object.fromEntries(branches.map((b) => [b.code, b.name])) };
  const resolvedItems = { all: "Tất cả trạng thái xử lý", ...Object.fromEntries(RESOLVED_OPTIONS.map((o) => [o.value, o.label])) };
  const daysItems = { all: "Mọi thời điểm", ...Object.fromEntries(DAYS_OPTIONS.map((o) => [o.value, o.label])) };

  function updateParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    router.push(`/followup-tracking?${params.toString()}`);
  }

  return (
    <div className="shadow-bubble mb-6 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center">
      <div className="flex shrink-0 items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <SlidersHorizontal className="size-3.5" />
        Bộ lọc
      </div>

      <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
        <Select items={resolvedItems} value={resolved} onValueChange={(v) => updateParams({ resolved: v ?? "all" })}>
          <SelectTrigger className="h-10 w-full rounded-xl bg-background">
            <SelectValue placeholder="Tất cả trạng thái xử lý" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái xử lý</SelectItem>
            {RESOLVED_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select items={daysItems} value={days} onValueChange={(v) => updateParams({ days: v ?? "all" })}>
          <SelectTrigger className="h-10 w-full rounded-xl bg-background">
            <SelectValue placeholder="Mọi thời điểm" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi thời điểm</SelectItem>
            {DAYS_OPTIONS.map((o) => (
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
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Xoá bộ lọc"
        disabled={!hasFilters}
        className="mx-auto shrink-0 rounded-xl text-status-received hover:bg-status-received-bg hover:text-status-received disabled:opacity-30 sm:mx-0"
        onClick={() => router.push("/followup-tracking")}
      >
        <RotateCcw className="size-4" />
      </Button>
    </div>
  );
}
