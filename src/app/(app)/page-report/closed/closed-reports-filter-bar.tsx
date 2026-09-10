"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function ClosedReportsFilterBar({ fanpageOptions }: { fanpageOptions: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const fanpage = searchParams.get("fanpage") ?? "all";

  // Truyền sẵn items cho Select — tránh Base UI hiển thị value thô ("all")
  // thay vì nhãn, do nhãn chỉ đăng ký được sau khi popup đã mount lần đầu.
  const fanpageItems = { all: "Tất cả Page", ...Object.fromEntries(fanpageOptions.map((f) => [f, f])) };

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    }
    router.push(`/page-report/closed?${params.toString()}`);
  }

  const hasFilters = !!from || !!to || fanpage !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="date"
        value={from}
        onChange={(e) => updateParams({ from: e.target.value })}
        className="h-10 w-[9.5rem] rounded-xl bg-background text-sm"
        aria-label="Từ ngày"
      />
      <span className="text-xs text-muted-foreground">–</span>
      <Input
        type="date"
        value={to}
        onChange={(e) => updateParams({ to: e.target.value })}
        className="h-10 w-[9.5rem] rounded-xl bg-background text-sm"
        aria-label="Đến ngày"
      />
      <Select items={fanpageItems} value={fanpage} onValueChange={(v) => updateParams({ fanpage: v })}>
        <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-44">
          <SelectValue placeholder="Tất cả Page" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả Page</SelectItem>
          {fanpageOptions.map((f) => (
            <SelectItem key={f} value={f}>
              {f}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Xoá bộ lọc"
          className="rounded-xl text-status-received hover:bg-status-received-bg hover:text-status-received"
          onClick={() => router.push("/page-report/closed")}
        >
          <RotateCcw className="size-4" />
        </Button>
      )}
    </div>
  );
}
