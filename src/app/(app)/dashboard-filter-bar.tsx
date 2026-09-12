"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const DAYS_OPTIONS = [
  { value: "7", label: "7 ngày gần nhất" },
  { value: "30", label: "30 ngày gần nhất" },
  { value: "90", label: "90 ngày gần nhất" },
];

export function DashboardFilterBar({
  branches,
  sources,
  fanpages,
}: {
  branches: { code: string; name: string }[];
  sources: string[];
  fanpages: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const days = searchParams.get("days") ?? "30";
  const branch = searchParams.get("branch") ?? "all";
  const source = searchParams.get("source") ?? "all";
  const fanpage = searchParams.get("fanpage") ?? "all";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const currentAdId = searchParams.get("adId") ?? "";
  const [adId, setAdId] = useState(currentAdId);

  const hasCustomRange = !!from || !!to;

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    router.push(`/?${params.toString()}`);
  }

  // Gõ xong mới lọc (debounce) — tránh điều hướng trang liên tục theo từng phím gõ.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (adId !== currentAdId) updateParams({ adId: adId.trim() || null });
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adId]);

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:flex-wrap">
      <Select
        value={hasCustomRange ? null : days}
        onValueChange={(v) => updateParams({ days: v ?? "30", from: null, to: null })}
      >
        <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-44">
          <SelectValue placeholder="Khoảng ngày tuỳ chỉnh" />
        </SelectTrigger>
        <SelectContent>
          {DAYS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={from}
          onChange={(e) => updateParams({ from: e.target.value || null })}
          aria-label="Từ ngày"
          className="h-10 w-full rounded-xl bg-background sm:w-36"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => updateParams({ to: e.target.value || null })}
          aria-label="Đến ngày"
          className="h-10 w-full rounded-xl bg-background sm:w-36"
        />
      </div>

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

      <Select value={fanpage} onValueChange={(v) => updateParams({ fanpage: v ?? "all" })}>
        <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-40">
          <SelectValue placeholder="Tất cả Fanpage" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả Fanpage</SelectItem>
          {fanpages.map((f) => (
            <SelectItem key={f} value={f}>
              {f}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative sm:w-40">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={adId}
          onChange={(e) => setAdId(e.target.value)}
          placeholder="Ad ID"
          className="h-10 rounded-xl bg-background pr-3 pl-9"
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Xoá bộ lọc"
        className="mx-auto shrink-0 rounded-xl text-status-received hover:bg-status-received-bg hover:text-status-received sm:mx-0"
        onClick={() => {
          setAdId("");
          router.push("/");
        }}
      >
        <RotateCcw className="size-4" />
      </Button>
    </div>
  );
}
