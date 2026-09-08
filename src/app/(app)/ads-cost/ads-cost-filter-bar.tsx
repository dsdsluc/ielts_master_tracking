"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function AdsCostFilterBar({
  sourceOptions,
  branchOptions,
}: {
  sourceOptions: string[];
  branchOptions: { code: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQ = searchParams.get("q") ?? "";
  const source = searchParams.get("source") ?? "all";
  const branch = searchParams.get("branch") ?? "all";
  const [q, setQ] = useState(currentQ);

  // Truyền sẵn items cho Select — tránh Base UI hiển thị value thô ("all")
  // thay vì nhãn, do nhãn chỉ đăng ký được sau khi popup đã mount lần đầu.
  const sourceItems = { all: "Tất cả nguồn", ...Object.fromEntries(sourceOptions.map((s) => [s, s])) };
  const branchItems = { all: "Tất cả cơ sở", ...Object.fromEntries(branchOptions.map((b) => [b.code, b.name])) };

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    router.push(`/ads-cost?${params.toString()}`);
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
      <div className="relative sm:w-52">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm Ad ID, tên quảng cáo…"
          className="h-10 rounded-xl bg-background pr-3 pl-9"
        />
      </div>
      <Select items={sourceItems} value={source} onValueChange={(v) => updateParams({ source: v })}>
        <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-36">
          <SelectValue placeholder="Tất cả nguồn" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả nguồn</SelectItem>
          {sourceOptions.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select items={branchItems} value={branch} onValueChange={(v) => updateParams({ branch: v })}>
        <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-36">
          <SelectValue placeholder="Tất cả cơ sở" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả cơ sở</SelectItem>
          {branchOptions.map((b) => (
            <SelectItem key={b.code} value={b.code}>
              {b.name}
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
          router.push("/ads-cost");
        }}
      >
        <RotateCcw className="size-4" />
      </Button>
    </div>
  );
}
